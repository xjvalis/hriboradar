import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildPinPickerHtml } from "../lib/leafletHtml";

/**
 * GET /api/map-pin?lat=&lon=&zoom=
 *
 * A single-marker "drop a pin exactly here" page, used by
 * LocationMapPicker.tsx when adding a saved place that isn't findable by
 * name search. No grid computation - just the point the caller already has
 * (from a name search or the default location), fast to load.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const zoom = req.query.zoom != null ? Number(req.query.zoom) : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Chybí nebo je neplatné lat/lon." });
    return;
  }

  const mapApiKey = process.env.MAPY_CZ_API_KEY ?? "";
  const html = buildPinPickerHtml({ lat, lon, zoom: Number.isFinite(zoom) ? zoom : undefined, mapApiKey });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end(html);
}
