import { createClient } from "@supabase/supabase-js";
import { cached } from "./cache";
import { MODEL_VERSION } from "./scoring";

// Below this many real observations in a (species, decile) bucket, don't
// apply any correction at all - at exactly 20 the Beta-Binomial blend in
// api/cron/recalibrate.ts (SHRINKAGE_K = 20) is still only half real data,
// half the safe global prior, so even right at the gate the number can't
// swing wildly on a handful of lucky/unlucky reports. Below it, skip the
// correction entirely rather than show something that could later jump
// back and forth as a couple more observations come in.
const MIN_SAMPLE_N = 20;
const STATS_CACHE_TTL_MS = 60 * 60 * 1000; // stats only change once/day (the cron job), no need to refetch more often

interface CalibrationStatsRow {
  species_id: string;
  probability_bucket: number;
  n: number;
  calibrated_probability: number;
}

async function fetchCalibrationStats(): Promise<Map<string, CalibrationStatsRow>> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new Map();

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from("hriboradar_calibration_stats")
    .select("species_id, probability_bucket, n, calibrated_probability")
    .eq("model_version", MODEL_VERSION)
    .neq("species_id", "__global__");
  if (error || !data) return new Map();

  return new Map(data.map((row) => [`${row.species_id}:${row.probability_bucket}`, row]));
}

function loadCalibrationStats(): Promise<Map<string, CalibrationStatsRow>> {
  // Keyed by MODEL_VERSION even though fetchCalibrationStats() already
  // filters its query by it on every cache miss (so a stale cache can't
  // actually serve the wrong version's rows today) - this is a defensive
  // belt-and-braces measure in case the caching layer ever changes (e.g.
  // a move to Vercel KV or a longer-lived process), where a fixed key
  // could otherwise let a warm cache outlive a version bump.
  return cached(`calibration-stats:${MODEL_VERSION}`, STATS_CACHE_TTL_MS, fetchCalibrationStats);
}

/**
 * Nudges a raw model probability toward what actually got found in that
 * probability decile for that species, per the nightly calibration job -
 * additive, not a hard snap to the bucket average, so the model's
 * fine-grained differentiation within a decile survives the correction.
 * Falls back to the raw value whenever calibration data doesn't exist yet
 * (fresh install, no feedback collected) or the lookup itself fails - this
 * must never be able to break a forecast response.
 */
export async function applyCalibratedProbability(rawPct: number, speciesId: string): Promise<number> {
  if (!Number.isFinite(rawPct)) return 0; // defensive - scoreSpeciesDay's own clamp() means this never happens today, but a NaN bucket key would otherwise silently pass NaN straight through to the client
  try {
    const stats = await loadCalibrationStats();
    const bucket = Math.min(90, Math.max(0, Math.floor(rawPct / 10) * 10));
    const row = stats.get(`${speciesId}:${bucket}`);
    if (!row || row.n < MIN_SAMPLE_N) return rawPct;

    const bucketMid = bucket + 5;
    const correction = row.calibrated_probability * 100 - bucketMid;
    return Math.min(100, Math.max(0, Math.round(rawPct + correction)));
  } catch {
    return rawPct;
  }
}
