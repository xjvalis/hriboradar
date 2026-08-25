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
  const speciesParam = typeof req.query.species === "string" ? req.query.species : undefined;
  const fzoom = req.query.fzoom != null ? Number(req.query.fzoom) : undefined;

  const grid = await computeGrid();
  // Only trusted as an *initial* mode if it's a species the grid actually
  // has - an unrecognized id here would otherwise leave the map's mode
  // pointed at a species with no data (silently blank), rather than just
  // falling back to "overall".
  const initialMode =
    speciesParam && grid.speciesList.some((sp) => sp.id === speciesParam)
      ? ({ type: "species", id: speciesParam } as const)
      : undefined;
  // "Kam dnes?" region taps ask for a zoomed-in initial view (fzoom) at
  // lat/lon - only meaningful together, and only if lat/lon are real
  // coordinates (they're otherwise optional, just for the location marker).
  const initialView =
    Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(fzoom)
      ? { lat: lat as number, lon: lon as number, zoom: fzoom as number }
      : undefined;
  const html = buildGridMapHtml({
    points: grid.points,
    speciesList: grid.speciesList,
    userLat: Number.isFinite(lat) ? lat : undefined,
    userLon: Number.isFinite(lon) ? lon : undefined,
    initialMode,
    initialView,
    mapApiKey: process.env.MAPY_CZ_API_KEY ?? "",
  });

  // This page embeds the current grid/species data inline and changes
  // whenever the app code changes - never let WebView/browser HTTP caching
  // serve a stale copy of it (bit us hard mid-dev: a WebView held onto an
  // old build of this exact page for hours with no way to tell from the
  // outside, since nothing here previously said not to cache it).
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end(html);
}
