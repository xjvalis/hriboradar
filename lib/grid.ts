import { fetchWeather } from "./weather";
import { weatherPotential, type Species } from "./scoring";
import { isInsideCzechia } from "./geo";
import speciesData from "../api/data/species.json";

// Shared by api/grid.ts (JSON, for the app's own map screen) and api/map.ts
// (HTML, for the WebView-rendered map page) - both need the exact same
// today's-probability-per-point data, just presented differently. Splitting
// this out avoids running the (expensive - two external fetches per point)
// computation twice or letting the two endpoints drift apart.

const BOUNDS = { latMin: 48.55, latMax: 51.06, lonMin: 12.09, lonMax: 18.87 };
const LAT_STEP = 0.14;
const LON_STEP = 0.2;
export const GRID_SPACING_M = 15000; // for the client to size interpolation falloff

function buildGridPoints(): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  for (let lat = BOUNDS.latMin; lat <= BOUNDS.latMax; lat += LAT_STEP) {
    for (let lon = BOUNDS.lonMin; lon <= BOUNDS.lonMax; lon += LON_STEP) {
      const rlat = Math.round(lat * 100) / 100;
      const rlon = Math.round(lon * 100) / 100;
      if (isInsideCzechia(rlat, rlon)) points.push({ lat: rlat, lon: rlon });
    }
  }
  return points;
}

export interface GridPointResult {
  lat: number;
  lon: number;
  overall: number;
  scores: Record<string, number>;
}

export interface GridData {
  generated_at: string;
  gridSpacingM: number;
  speciesList: { id: string; name_cz: string; host_trees: string[] }[];
  points: GridPointResult[];
}

// "Overall" is deliberately not max(species) and not mean(all 15 species):
// max would make it identical to "the best species today" (the whole point
// of the two map modes is that those are different questions); a flat mean
// gets diluted into near-invisibility by the dozen species that are always
// a bad fit for a given spot's terrain. A weighted average of the best few
// species is a reasonable proxy for "general favorability" without either
// problem. NOTE: this ranks by weather-only potential (terrain isn't known
// yet at this stage, see the module comment below) - the client applies
// each real forest polygon's own exact terrain after interpolating these
// weather scores, and re-derives "overall" from the terrain-adjusted
// per-species numbers at that point (see leafletHtml.ts's overallAccessor).
const OVERALL_WEIGHTS = [0.5, 0.3, 0.2];

// Exported for api/cron/watchdog.ts, which needs the exact same "overall"
// definition when a saved location's watchdog isn't scoped to one species -
// duplicating this formula there would drift the moment one changed.
export function overallScore(scores: Record<string, number>): number {
  const top = Object.values(scores)
    .sort((a, b) => b - a)
    .slice(0, OVERALL_WEIGHTS.length);
  const weighted = top.reduce((sum, v, i) => sum + v * OVERALL_WEIGHTS[i], 0);
  const weightUsed = OVERALL_WEIGHTS.slice(0, top.length).reduce((a, b) => a + b, 0);
  return weightUsed > 0 ? Math.round(weighted / weightUsed) : 0;
}

// Deliberately weather-only, no terrain lookup at all - these points are
// ~15km apart (GRID_SPACING_M), spaced far too sparsely for their own
// individual terrain to mean anything (a real forest polygon is almost
// never within a few hundred meters of one of these fixed sample points).
// Weather genuinely is smooth over that distance, so interpolating it
// (leafletHtml.ts's interpolate()) is honest; terrain is not smooth (sharp
// forest edges), so it's looked up exactly per forest polygon instead - see
// api/forest.ts, which attaches each real polygon's own precise terrain
// once, and leafletHtml.ts's computeScored, which combines the two. Found
// 2026-08-28: applying terrain at this sparse-grid stage (even with a wider
// search radius) let real forest several km from a sample point get
// credited to that point, producing pulsing "hotspot" markers that read
// high on the map but a precise tap right next to them showed ~28%.
export async function computeGrid(): Promise<GridData> {
  const species = speciesData.species as Species[];
  const points = buildGridPoints();
  const todayStr = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    points.map(async (pt): Promise<GridPointResult | null> => {
      try {
        const days = await fetchWeather(pt.lat, pt.lon);
        const todayIndex = days.findIndex((d) => d.date === todayStr);
        if (todayIndex < 0) return null;

        const scores: Record<string, number> = {};
        for (const sp of species) {
          scores[sp.id] = weatherPotential(days, todayIndex, sp);
        }
        return { lat: pt.lat, lon: pt.lon, overall: overallScore(scores), scores };
      } catch {
        return null;
      }
    })
  );

  return {
    generated_at: new Date().toISOString(),
    gridSpacingM: GRID_SPACING_M,
    speciesList: species.map((sp) => ({ id: sp.id, name_cz: sp.name_cz, host_trees: sp.host_trees })),
    points: results.filter((r): r is GridPointResult => !!r),
  };
}
