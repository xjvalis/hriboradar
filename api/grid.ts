import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWeather } from "./lib/weather";
import { fetchTerrain } from "./lib/terrain";
import { scoreSpeciesDay, type Species } from "./lib/scoring";
import { isInsideCzechia } from "./lib/geo";
import speciesData from "./data/species.json";

/**
 * GET /api/grid
 *
 * Today's probability for every species, across a grid of points clipped
 * to the real Czech Republic border (not a rectangle — the first version
 * painted circles into Germany/Austria/Poland/Slovakia, which was wrong).
 *
 * Returns full per-species scores per point (not just "today's winner")
 * so the client can filter by species, or by "top 3 today", without a
 * refetch — the expensive part is the two external fetches per point,
 * which happen once regardless of how many species we score from them.
 */

const BOUNDS = { latMin: 48.55, latMax: 51.06, lonMin: 12.09, lonMax: 18.87 };
const LAT_STEP = 0.28;
const LON_STEP = 0.4;
export const GRID_SPACING_M = 30000; // for the client to size each point's heat radius

function buildGridPoints(): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  for (let lat = BOUNDS.latMin; lat <= BOUNDS.latMax; lat += LAT_STEP) {
    for (let lon = BOUNDS.lonMin; lon <= BOUNDS.lonMax; lon += LON_STEP) {
      const rlat = Math.round(lat * 100) / 100;
      const rlon = Math.round(lon * 100) / 100;
      if (isInsideCzechia(rlat, rlon)) points.push({ lat: rlat, lon: rlon });
    }
  }
  return points;
}

interface GridPointResult {
  lat: number;
  lon: number;
  scores: Record<string, number>; // speciesId -> probability_pct
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
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

        const scores: Record<string, number> = {};
        for (const sp of species) {
          scores[sp.id] = scoreSpeciesDay(days, todayIndex, sp, terrain).probability_pct;
        }
        return { lat: pt.lat, lon: pt.lon, scores };
      } catch {
        return null;
      }
    })
  );

  res.status(200).json({
    generated_at: new Date().toISOString(),
    gridSpacingM: GRID_SPACING_M,
    speciesList: species.map((sp) => ({ id: sp.id, name_cz: sp.name_cz })),
    points: results.filter((r): r is GridPointResult => !!r),
  });
}
