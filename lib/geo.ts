import czBorder from "../api/data/cz_border.json";

const RING = czBorder.coordinates as number[][]; // [lon, lat] pairs, as GeoJSON stores them

/** Standard ray-casting point-in-polygon test. lat/lon in degrees. */
export function isInsideCzechia(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const [loni, lati] = RING[i];
    const [lonj, latj] = RING[j];
    const intersects =
      lati > lat !== latj > lat &&
      lon < ((lonj - loni) * (lat - lati)) / (latj - lati) + loni;
    if (intersects) inside = !inside;
  }
  return inside;
}
