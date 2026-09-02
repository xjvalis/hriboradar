/**
 * Shared lat/lon query-param validation for every endpoint that takes a
 * real-world coordinate. `Number.isNaN` alone (the pattern a couple of
 * these endpoints used) still lets Infinity or a wildly out-of-range
 * number through - not a crash risk (lib/terrain.ts's bounding-box check
 * and Open-Meteo's own API both degrade gracefully on nonsense input), but
 * it means a bad request reads as a confusing 500 from deep inside the
 * handler instead of a clean 400 at the door, and it's a free way to burn
 * upstream API quota on requests that can never produce a useful answer.
 */
export function parseLatLon(query: { lat?: unknown; lon?: unknown }): { lat: number; lon: number } | null {
  // Reject before coercing - Number(null) is 0 (a "valid" coordinate!) and
  // Number(["50","51"]) depends on array length in a way that's more
  // confusing than useful. A real Vercel query value is only ever
  // undefined (missing), a string, or string[] (duplicated param); only
  // the plain-string case should ever reach Number() below.
  if (typeof query.lat !== "string" || typeof query.lon !== "string") return null;
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
