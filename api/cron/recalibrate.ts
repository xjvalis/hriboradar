import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { MODEL_VERSION } from "../lib/scoring";

// Pseudo-observations pulling a sparse species+bucket toward the
// species-agnostic rate for that same bucket (Beta-Binomial shrinkage) - at
// n=0 a species bucket is just the global rate; by n>>SHRINKAGE_K it's
// essentially its own empirical rate. Keeps one enthusiastic user who found
// smrže three times in a row from single-handedly creating an aggressive
// species-specific calibration off three data points.
const SHRINKAGE_K = 20;

interface Agg {
  n: number;
  successes: number;
  brierSum: number;
}

function bucketOf(pct: number): number {
  return Math.min(90, Math.floor(pct / 10) * 10);
}

/**
 * POST /api/cron/recalibrate - nightly job (see vercel.json) that turns raw
 * rostou_feedback rows into the per-(species, probability decile,
 * model_version) calibration_stats api/lib/calibration.ts reads at
 * forecast-serving time.
 *
 * Runs with the service_role key deliberately - it's the only piece of this
 * system allowed to read feedback across every user at once (RLS blocks
 * that for the anon/authenticated roles by design, see rostou_schema.sql).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: "Supabase service role not configured" });
    return;
  }

  const supabase = createClient(url, serviceKey);

  const { data: rows, error } = await supabase
    .from("rostou_feedback")
    .select("species_id, predicted_probability, found")
    .eq("model_version", MODEL_VERSION);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const bySpeciesBucket = new Map<string, Agg>();
  const globalByBucket = new Map<number, Agg>();

  for (const row of rows ?? []) {
    const bucket = bucketOf(row.predicted_probability);
    const result = row.found ? 1 : 0;
    const brier = (row.predicted_probability / 100 - result) ** 2;

    const speciesKey = `${row.species_id}:${bucket}`;
    const s = bySpeciesBucket.get(speciesKey) ?? { n: 0, successes: 0, brierSum: 0 };
    s.n += 1;
    s.successes += result;
    s.brierSum += brier;
    bySpeciesBucket.set(speciesKey, s);

    const g = globalByBucket.get(bucket) ?? { n: 0, successes: 0, brierSum: 0 };
    g.n += 1;
    g.successes += result;
    g.brierSum += brier;
    globalByBucket.set(bucket, g);
  }

  const now = new Date().toISOString();

  const speciesUpserts = Array.from(bySpeciesBucket.entries()).map(([key, agg]) => {
    const sepIndex = key.lastIndexOf(":");
    const speciesId = key.slice(0, sepIndex);
    const bucket = Number(key.slice(sepIndex + 1));
    const global = globalByBucket.get(bucket)!; // always present - every species row also fed the global aggregate for its bucket
    const globalRate = global.successes / global.n;
    const calibrated = (agg.successes + SHRINKAGE_K * globalRate) / (agg.n + SHRINKAGE_K);

    return {
      species_id: speciesId,
      probability_bucket: bucket,
      model_version: MODEL_VERSION,
      n: agg.n,
      successes: agg.successes,
      calibrated_probability: Math.round(calibrated * 1000) / 1000,
      brier_score: Math.round((agg.brierSum / agg.n) * 1000) / 1000,
      global_n: global.n,
      global_successes: global.successes,
      updated_at: now,
    };
  });

  // Species-agnostic rows under a synthetic id - not read by
  // applyCalibratedProbability (real species ids never collide with it),
  // but useful on their own for a calibration-curve/Brier-score query
  // without having to average every species row back together by hand.
  const globalUpserts = Array.from(globalByBucket.entries()).map(([bucket, agg]) => ({
    species_id: "__global__",
    probability_bucket: bucket,
    model_version: MODEL_VERSION,
    n: agg.n,
    successes: agg.successes,
    calibrated_probability: Math.round((agg.successes / agg.n) * 1000) / 1000,
    brier_score: Math.round((agg.brierSum / agg.n) * 1000) / 1000,
    global_n: agg.n,
    global_successes: agg.successes,
    updated_at: now,
  }));

  const upserts = [...speciesUpserts, ...globalUpserts];

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from("rostou_calibration_stats")
      .upsert(upserts, { onConflict: "species_id,probability_bucket,model_version" });
    if (upsertError) {
      res.status(500).json({ error: upsertError.message });
      return;
    }
  }

  res.status(200).json({
    ok: true,
    total_feedback_rows: rows?.length ?? 0,
    buckets_updated: upserts.length,
  });
}
