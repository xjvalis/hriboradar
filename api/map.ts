import type { VercelRequest, VercelResponse } from "@vercel/node";
import { computeGrid } from "../lib/grid";
import { buildGridMapHtml } from "../lib/leafletHtml";

/**
 * GET /api/map?lat=&lon=
 *
 * The Mapa screen's probability-cloud page, as real HTML - not JSON passed
 * through react-native-webview's `source={{ html }}` prop, which silently
 * fails to render on a real device once the page gets this large (Leaflet +
 * every grid point serialized inline). A normal HTTP-fetched page sidesteps
 * that entirely (see mobile/src/screens/MapScreen.tsx). lat/lon are optional
 * and only used to draw the "your location" marker.
 *
 * This did not exist as a real endpoint before - only dev-server.mjs served
 * it locally, which meant the native Mapa screen would 404 in production
 * (the web build never hits this path; it builds the same HTML client-side
 * and drops it into an iframe instead, see MapScreen.web.tsx).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
  const lon = req.query.lon != null ? Number(req.query.lon) : undefined;

  const grid = await computeGrid();
  const html = buildGridMapHtml({
    points: grid.points,
    speciesList: grid.speciesList,
    userLat: Number.isFinite(lat) ? lat : undefined,
    userLon: Number.isFinite(lon) ? lon : undefined,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).end(html);
}
