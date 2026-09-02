import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cached, roundCoord } from "../lib/cache";
import { parseLatLon } from "../lib/validate";

/**
 * GET /api/geocode?q=<text>
 * GET /api/geocode?lat=<n>&lon=<n>  (reverse - turns "Aktuální poloha" GPS
 * coordinates into a real place name instead of showing raw numbers)
 *
 * Place-name search for the location picker. Proxied server-side rather
 * than called directly from the app: Nominatim's usage policy explicitly
 * prohibits implementing search-as-you-type (or reverse lookups) against
 * their public instance from a client, only from a server that identifies
 * itself and can be rate-limited/blocked as a single well-behaved caller
 * (same reasoning as the Overpass terrain lookups in lib/terrain.ts).
 */

const GEOCODE_CACHE_TTL_MS = 30 * 60 * 1000;
const GEOCODE_TIMEOUT_MS = 5000;

export interface GeocodeResult {
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

async function fetchNominatim(q: string): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=cz&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HriboradarApp/0.1 (+https://github.com/xjvalis/hriboradar)" },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const data = (await res.json()) as NominatimResult[];
  return data.map((d) => {
    const [label, ...rest] = d.display_name.split(", ");
    return { label, sublabel: rest.join(", "), lat: parseFloat(d.lat), lon: parseFloat(d.lon) };
  });
}

async function fetchNominatimReverse(lat: number, lon: number): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HriboradarApp/0.1 (+https://github.com/xjvalis/hriboradar)" },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const d = (await res.json()) as NominatimResult;
  const [label, ...rest] = d.display_name.split(", ");
  // The real GPS fix, not Nominatim's (coarser, settlement-centroid) point -
  // this is what "use my current location" is actually for.
  return { label, sublabel: rest.join(", "), lat, lon };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsed = req.query.lat != null || req.query.lon != null ? parseLatLon(req.query) : null;
  if (parsed) {
    const { lat, lon } = parsed;
    try {
      const result = await cached(`rgeocode:${roundCoord(lat)},${roundCoord(lon)}`, GEOCODE_CACHE_TTL_MS, () =>
        fetchNominatimReverse(lat, lon)
      );
      res.status(200).json({ results: [result] });
    } catch {
      res.status(200).json({ results: [] });
    }
    return;
  }

  const q = String(req.query.q ?? "").trim();
  if (q.length < 3) {
    res.status(200).json({ results: [] });
    return;
  }

  try {
    const results = await cached(`geocode:${q.toLowerCase()}`, GEOCODE_CACHE_TTL_MS, () => fetchNominatim(q));
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
