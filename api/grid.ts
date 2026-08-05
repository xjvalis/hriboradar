import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWeather } from "./lib/weather";
import { fetchTerrain } from "./lib/terrain";
import { scoreSpeciesDay, type Species } from "./lib/scoring";
import speciesData from "./data/species.json";

/**
 * GET /api/grid?threshold=20
 *
 * Today's best-species probability across a grid covering the Czech
 * Republic, for the map screen. Each point is real (same weather/terrain/
 * scoring pipeline as /api/forecast), not interpolated — just coarser and
 * "today only" so a country-wide grid is actually fast enough to compute.
 *
 * Only points at or above `threshold` are returned — the map is meant to
 * show "where's actually worth going", not the whole country tinted at
 * 3%. Default 20 for dev/testing (so the grid has visible points even
 * during a dry spell); a live deployment should default this to ~40.
 */

const BOUNDS = { latMin: 48.55, latMax: 51.06, lonMin: 12.09, lonMax: 18.87 };
const LAT_STEP = 0.5; // ~55km
const LON_STEP = 0.7; // ~50km at this latitude
export const GRID_SPACING_M = 45000; // used by the client to size each point's area circle

function buildGridPoints(): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  for (let lat = BOUNDS.latMin; lat <= BOUNDS.latMax; lat += LAT_STEP) {
    for (let lon = BOUNDS.lonMin; lon <= BOUNDS.lonMax; lon += LON_STEP) {
      points.push({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
    }
  }
  return points;
}

interface GridPointResult {
  lat: number;
  lon: number;
  probabilityPct: number;
  topSpeciesName: string;
  topSpeciesId: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const threshold = req.query.threshold ? Number(req.query.threshold) : 20;
  const species = speciesData.species as Species[];
  const points = buildGridPoints();
  const todayStr = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    points.map(async (pt): Promise<GridPointResult | null> => {
      try {
        const [days, terrain] = await Promise.all([
          fetchWeather(pt.lat, pt.lon),
          fetchTerrain(pt.lat, pt.lon),
        ]);
        const todayIndex = days.findIndex((d) => d.date === todayStr);
        if (todayIndex < 0) return null;

        let best: { id: string; name: string; pct: number } | null = null;
        for (const sp of species) {
          const score = scoreSpeciesDay(days, todayIndex, sp, terrain);
          if (!best || score.probability_pct > best.pct) {
            best = { id: sp.id, name: sp.name_cz, pct: score.probability_pct };
          }
        }
        if (!best || best.pct < threshold) return null;
        return {
          lat: pt.lat,
          lon: pt.lon,
          probabilityPct: best.pct,
          topSpeciesName: best.name,
          topSpeciesId: best.id,
        };
      } catch {
        return null;
      }
    })
  );

  res.status(200).json({
    generated_at: new Date().toISOString(),
    threshold,
    gridSpacingM: GRID_SPACING_M,
    points: results.filter((r): r is GridPointResult => !!r),
  });
}
