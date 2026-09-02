import { isInsideCzechia } from "./geo";

// Extracted from lib/grid.ts (2026-09-03) so lib/weather.ts can snap an
// arbitrary lat/lon to the same fixed set of points without a circular
// import (grid.ts already depends on weather.ts for fetchWeather).

const BOUNDS = { latMin: 48.55, latMax: 51.06, lonMin: 12.09, lonMax: 18.87 };
const LAT_STEP = 0.14;
const LON_STEP = 0.2;
export const GRID_SPACING_M = 15000; // for the client to size interpolation falloff

export interface GridPoint {
  lat: number;
  lon: number;
}

let cachedPoints: GridPoint[] | null = null;

export function buildGridPoints(): GridPoint[] {
  if (cachedPoints) return cachedPoints;
  const points: GridPoint[] = [];
  for (let lat = BOUNDS.latMin; lat <= BOUNDS.latMax; lat += LAT_STEP) {
    for (let lon = BOUNDS.lonMin; lon <= BOUNDS.lonMax; lon += LON_STEP) {
      const rlat = Math.round(lat * 100) / 100;
      const rlon = Math.round(lon * 100) / 100;
      if (isInsideCzechia(rlat, rlon)) points.push({ lat: rlat, lon: rlon });
    }
  }
  cachedPoints = points;
  return points;
}

/**
 * The fixed grid point closest to an arbitrary lat/lon - lets any caller
 * (a user's exact GPS fix, a saved location) share the same once-daily
 * precomputed weather as the map, instead of needing its own live fetch.
 * Weather is smooth enough over GRID_SPACING_M (15km) that this is an
 * honest approximation, not a real accuracy loss - see lib/weather.ts.
 */
export function nearestGridPoint(lat: number, lon: number): GridPoint {
  const points = buildGridPoints();
  // Plain-degree distance would overweight longitude at this latitude
  // (a degree of longitude is ~35% shorter than a degree of latitude
  // around 50°N) - scaling by cos(lat) keeps "nearest" geographically
  // honest rather than just numerically nearest in raw degrees.
  const lonScale = Math.cos((lat * Math.PI) / 180);
  let best = points[0];
  let bestDist = Infinity;
  for (const pt of points) {
    const dLat = pt.lat - lat;
    const dLon = (pt.lon - lon) * lonScale;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }
  return best;
}
