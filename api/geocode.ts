import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cached } from "./lib/cache";

/**
 * GET /api/geocode?q=<text>
 *
 * Place-name search for the location picker. Proxied server-side rather
 * than called directly from the app: Nominatim's usage policy explicitly
 * prohibits implementing search-as-you-type against their public instance
 * from a client, only from a server that identifies itself and can be
 * rate-limited/blocked as a single well-behaved caller (same reasoning as
 * the Overpass terrain lookups in lib/terrain.ts).
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
    headers: { "User-Agent": "RostouApp/0.1 (+https://github.com/xjvalis/rostou)" },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const data = (await res.json()) as NominatimResult[];
  return data.map((d) => {
    const [label, ...rest] = d.display_name.split(", ");
    return { label, sublabel: rest.join(", "), lat: parseFloat(d.lat), lon: parseFloat(d.lon) };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
