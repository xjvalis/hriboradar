import type { VercelRequest, VercelResponse } from "@vercel/node";
import forestData from "./data/forest-cz.json";
import { fetchTerrain, type DominantForestType } from "../lib/terrain";

/**
 * GET /api/forest
 *
 * Static Czech forest/wood polygon outlines (from OpenStreetMap, simplified
 * and area-filtered offline - see data-prep/ at the repo root), used by the
 * Mapa screen to mask the probability overlay so color only ever appears
 * over real forest, not over cities/fields/water. Doesn't depend on lat/lon
 * or the current date like grid.ts does, so it's cacheable hard - the map
 * page fetches this once per session, not per location change or species
 * toggle.
 *
 * Each polygon also carries its own exact terrain (tree genera / leaf type /
 * isUrban), computed once below and cached for the life of the serverless
 * instance - a polygon's centroid genuinely sits in/near that specific
 * forest, so this is a precise, non-interpolated lookup (unlike the sparse
 * ~15km weather grid in lib/grid.ts, which no longer carries terrain at
 * all - see that file's module comment). leafletHtml.ts combines the two:
 * interpolated weather x this exact terrain, per polygon.
 */

interface PolygonTerrain {
  treeGenera: string[];
  dominantType: DominantForestType;
  isUrban: boolean;
}

let cached: { polygons: number[][][][]; terrain: PolygonTerrain[] } | null = null;

function centroidOf(outerRing: number[][]): [number, number] {
  let sumLat = 0;
  let sumLon = 0;
  for (const [lat, lon] of outerRing) {
    sumLat += lat;
    sumLon += lon;
  }
  return [sumLat / outerRing.length, sumLon / outerRing.length];
}

async function buildCache() {
  const polygons = (forestData as { polygons: number[][][][] }).polygons;
  const terrain = await Promise.all(
    polygons.map(async (rings): Promise<PolygonTerrain> => {
      const [lat, lon] = centroidOf(rings[0]);
      const t = await fetchTerrain(lat, lon);
      return { treeGenera: t.treeGenera, dominantType: t.dominantType, isUrban: t.isUrban };
    })
  );
  cached = { polygons, terrain };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!cached) await buildCache();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // 6h, not 24h+ - this is a static-ish asset (forest boundaries don't
  // move), but keeping the window short-ish means a bad deploy of this
  // data self-heals same-day instead of every client staying stuck on a
  // broken/empty response for a full day (see the very real "browser
  // cached my broken empty polygons list" mess this caused mid-dev).
  res.setHeader("Cache-Control", "public, max-age=21600");
  res.status(200).end(JSON.stringify(cached));
}
