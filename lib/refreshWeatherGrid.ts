import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGridPoints, type GridPoint } from "./gridPoints";
import { fetchWeatherUncached, type DayWeather } from "./weather";

// Lives under lib/, not api/cron/, even though it's only ever called from
// api/cron/recalibrate.ts's handler - the Hobby plan caps a deployment at
// 12 Serverless Functions, and every file under api/ counts as one
// regardless of what it exports. This used to be its own
// api/cron/refresh-weather.ts route with its own vercel.json cron entry;
// that pushed the project to 13 functions and silently broke every deploy
// (readyState ERROR, errorCode exceeded_serverless_functions_per_deployment
// - found 2026-09-03 the hard way, after a full night with no working
// deploy). Folding it into recalibrate.ts's existing daily run keeps the
// function count unchanged.

// How many grid points to fetch from Open-Meteo at once. Deliberately far
// below their free-tier 600/min rate limit (see lib/weather.ts's module
// comment on why this exists at all) - the ~350-point map used to fire
// every point in one Promise.all, and that single-instant burst (not the
// steady-state daily count, which is trivial) is what was tripping
// 429/503s. Spacing batches out avoids reproducing the same burst here.
const CONCURRENCY = 15;
const BATCH_DELAY_MS = 300;

interface PointResult {
  point: GridPoint;
  days: DayWeather[] | null;
  error?: string;
}

async function refreshPoint(point: GridPoint): Promise<PointResult> {
  try {
    const days = await fetchWeatherUncached(point.lat, point.lon);
    return { point, days };
  } catch (err) {
    return { point, days: null, error: String((err as Error)?.message ?? err) };
  }
}

async function refreshInBatches(points: GridPoint[]): Promise<PointResult[]> {
  const results: PointResult[] = [];
  for (let i = 0; i < points.length; i += CONCURRENCY) {
    const batch = points.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(refreshPoint));
    results.push(...batchResults);
    if (i + CONCURRENCY < points.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}

export interface RefreshWeatherGridResult {
  totalPoints: number;
  succeeded: number;
  failed: number;
  error?: string;
}

/**
 * Pre-fetches Open-Meteo weather for every fixed map grid point (~350,
 * lib/gridPoints.ts) and writes it to hriboradar_weather_grid.
 * lib/weather.ts's fetchWeather() reads from that table instead of
 * calling Open-Meteo live on every request - see its module comment for
 * why (measured ~48% of /api/forecast requests 500ing under real traffic
 * before this existed, 2026-09-03).
 *
 * A point that fails here simply keeps its previous day's row (upsert
 * only touches points that succeeded) rather than the whole job failing -
 * a transient Open-Meteo hiccup during this run degrades to "yesterday's
 * weather for that one point" for a day, not a gap.
 *
 * Takes an already-authenticated service_role client rather than creating
 * its own - the caller (api/cron/recalibrate.ts) already has one.
 */
export async function refreshWeatherGrid(supabase: SupabaseClient): Promise<RefreshWeatherGridResult> {
  const points = buildGridPoints();
  const results = await refreshInBatches(points);

  const succeeded = results.filter((r): r is PointResult & { days: DayWeather[] } => r.days != null);
  const failed = results.filter((r) => r.days == null);

  if (succeeded.length > 0) {
    const now = new Date().toISOString();
    const rows = succeeded.map((r) => ({
      grid_lat: r.point.lat,
      grid_lon: r.point.lon,
      days: r.days,
      updated_at: now,
    }));
    const { error } = await supabase.from("hriboradar_weather_grid").upsert(rows, { onConflict: "grid_lat,grid_lon" });
    if (error) {
      return { totalPoints: points.length, succeeded: succeeded.length, failed: failed.length, error: error.message };
    }
  }

  if (failed.length > 0) {
    console.warn(
      `[refresh-weather] ${failed.length}/${points.length} points failed:`,
      failed.slice(0, 5).map((r) => `${r.point.lat},${r.point.lon}: ${r.error}`)
    );
  }

  return { totalPoints: points.length, succeeded: succeeded.length, failed: failed.length };
}
