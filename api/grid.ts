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
 * to the real Czech Republic border (not a rectangle - the first version
 * painted circles into Germany/Austria/Poland/Slovakia, which was wrong).
 *
 * Returns both a per-point "overall" score and full per-species scores, so
 * the client can switch between "všechny houby" and any single species
 * without a refetch - the expensive part is the two external fetches per
 * point, which happen once regardless of how many species we score from
 * them.
 */

const BOUNDS = { latMin: 48.55, latMax: 51.06, lonMin: 12.09, lonMax: 18.87 };
// Denser than the original 0.28/0.4 grid - the client now interpolates a
// smooth field between points rather than drawing one shape per point, and
// that interpolation only looks genuinely precise (forest-scale islands,
// not province-scale blobs) when the source grid is fine enough to feed it.
const LAT_STEP = 0.14;
const LON_STEP = 0.2;
export const GRID_SPACING_M = 15000; // for the client to size interpolation falloff

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
  overall: number; // "how good are conditions here in general", distinct from any one species
  scores: Record<string, number>; // speciesId -> probability_pct
}

// "Overall" is deliberately not max(species) and not mean(all 15 species):
// max would make it identical to "the best species today" (the whole point
// of the two map modes is that those are different questions); a flat mean
// gets diluted into near-invisibility by the dozen species that are always
// a bad fit for a given spot's terrain. A weighted average of the best few
// species is a reasonable proxy for "general favorability" without either
// problem - literature-informed starting weights, same caveat as the rest
// of the scoring model (see species.json _meta).
const OVERALL_WEIGHTS = [0.5, 0.3, 0.2];

function overallScore(scores: Record<string, number>): number {
  const top = Object.values(scores)
    .sort((a, b) => b - a)
    .slice(0, OVERALL_WEIGHTS.length);
  const weighted = top.reduce((sum, v, i) => sum + v * OVERALL_WEIGHTS[i], 0);
  const weightUsed = OVERALL_WEIGHTS.slice(0, top.length).reduce((a, b) => a + b, 0);
  return weightUsed > 0 ? Math.round(weighted / weightUsed) : 0;
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
        return { lat: pt.lat, lon: pt.lon, overall: overallScore(scores), scores };
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
