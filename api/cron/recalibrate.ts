import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { MODEL_VERSION } from "../../lib/scoring";

// Pseudo-observations pulling a sparse species+bucket toward the
// species-agnostic rate for that same bucket (Beta-Binomial shrinkage) - at
// n=0 a species bucket is just the global rate; by n>>SHRINKAGE_K it's
// essentially its own empirical rate. Keeps one enthusiastic user who found
// smrže three times in a row from single-handedly creating an aggressive
// species-specific calibration off three data points.
const SHRINKAGE_K = 20;

// Feedback from the last HOLDOUT_DAYS is excluded from fitting
// calibration_stats and used only to evaluate it - without this split, the
// reported Brier score/AUC would be measured on the same rows that
// produced the correction, which is optimistically biased (of course a
// correction fits the data it was computed from). Simple time-based split
// rather than a random holdout - honest here means "how did the model do
// on observations it hadn't seen yet when it was last calibrated", which
// is specifically a *temporal* question. 14 days is a few nights' worth of
// fresh feedback without starving the fit set on a still-small dataset.
const HOLDOUT_DAYS = 14;

interface Agg {
  n: number;
  successes: number;
  brierSum: number;
}

function bucketOf(pct: number): number {
  return Math.min(90, Math.floor(pct / 10) * 10);
}

// Calibration ("when the model says 70%, does it happen ~70% of the time")
// and discrimination ("does location A at 80% actually beat location B at
// 40%") are different questions - Brier score/calibrated_probability above
// answer the first, this answers the second. AUC via the standard
// Mann-Whitney U rank-sum method: sort every feedback row by its predicted
// probability, sum the ranks landed on by the "found" rows, compare
// against what a rank-sum of that size would average under pure chance.
// 0.5 = no better than random ordering, 1.0 = perfect ranking. This can be
// good even when calibration is off (systematically over/under-confident
// but the ORDER is still right) and vice versa - worth tracking
// separately, not folded into brier_score.
function computeAUC(rows: { predicted_probability: number; found: boolean }[]): number | null {
  const nPos = rows.filter((r) => r.found).length;
  const nNeg = rows.length - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  const sorted = [...rows].sort((a, b) => a.predicted_probability - b.predicted_probability);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].predicted_probability === sorted[i].predicted_probability) j++;
    const avgRank = (i + j) / 2 + 1; // ties share the average of their rank span, 1-indexed
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  let rankSumPos = 0;
  for (let k = 0; k < sorted.length; k++) if (sorted[k].found) rankSumPos += ranks[k];
  const u = rankSumPos - (nPos * (nPos + 1)) / 2;
  return Math.round((u / (nPos * nNeg)) * 1000) / 1000;
}

/**
 * POST /api/cron/recalibrate - nightly job (see vercel.json) that turns raw
 * hriboradar_feedback rows into the per-(species, probability decile,
 * model_version) calibration_stats lib/calibration.ts reads at
 * forecast-serving time.
 *
 * Feedback older than HOLDOUT_DAYS fits calibration_stats; feedback newer
 * than that is held out and only used to report holdout_brier_score/
 * holdout_auc - an honest, out-of-sample read on how the current
 * correction is actually doing, not a number measured on the same data
 * that produced it.
 *
 * Runs with the service_role key deliberately - it's the only piece of this
 * system allowed to read feedback across every user at once (RLS blocks
 * that for the anon/authenticated roles by design, see hriboradar_schema.sql).
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
    .from("hriboradar_feedback")
    .select("species_id, predicted_probability, found, observed_at")
    .eq("model_version", MODEL_VERSION);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const holdoutCutoff = new Date(Date.now() - HOLDOUT_DAYS * 86400000).toISOString().slice(0, 10);
  const fitRows = (rows ?? []).filter((r) => r.observed_at < holdoutCutoff);
  const holdoutRows = (rows ?? []).filter((r) => r.observed_at >= holdoutCutoff);

  const bySpeciesBucket = new Map<string, Agg>();
  const globalByBucket = new Map<number, Agg>();

  for (const row of fitRows) {
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
      .from("hriboradar_calibration_stats")
      .upsert(upserts, { onConflict: "species_id,probability_bucket,model_version" });
    if (upsertError) {
      res.status(500).json({ error: upsertError.message });
      return;
    }
  }

  // Overall (not per-bucket) diagnostics, measured ONLY on holdoutRows -
  // see HOLDOUT_DAYS above for why. A single headline number per
  // model_version, cheap to compute from rows already fetched. Not
  // persisted to hriboradar_calibration_stats (that table's shape is
  // per-bucket) - returned here so a manual invocation or the Vercel cron
  // log can see it; a real trend-over-time view would need its own small
  // table, not worth adding until this is actually being watched.
  function overallBrierOf(sample: { predicted_probability: number; found: boolean }[]): number | null {
    if (sample.length === 0) return null;
    const sum = sample.reduce((acc, r) => acc + (r.predicted_probability / 100 - (r.found ? 1 : 0)) ** 2, 0);
    return Math.round((sum / sample.length) * 1000) / 1000;
  }

  res.status(200).json({
    ok: true,
    total_feedback_rows: rows?.length ?? 0,
    fit_rows: fitRows.length,
    holdout_rows: holdoutRows.length,
    buckets_updated: upserts.length,
    // Out-of-sample: computed on holdoutRows, which never fed the fit above.
    holdout_brier_score: overallBrierOf(holdoutRows),
    holdout_auc: computeAUC(holdoutRows),
  });
}
