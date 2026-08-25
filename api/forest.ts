import type { VercelRequest, VercelResponse } from "@vercel/node";
import forestData from "./data/forest-cz.json";

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
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // 6h, not 24h+ - this is a static-ish asset (forest boundaries don't
  // move), but keeping the window short-ish means a bad deploy of this
  // data self-heals same-day instead of every client staying stuck on a
  // broken/empty response for a full day (see the very real "browser
  // cached my broken empty polygons list" mess this caused mid-dev).
  res.setHeader("Cache-Control", "public, max-age=21600");
  res.status(200).end(JSON.stringify(forestData));
}
