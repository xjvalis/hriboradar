import type { DayWeather } from "./weather";
import { daysSinceRain } from "./weather";
import { terrainMatchFactor, type TerrainInfo } from "./terrain";

// Stamped on every feedback row and calibration-stats bucket (see
// api/feedback.ts, api/cron/recalibrate.ts) so a future change to the
// scoring formula below starts its own calibration cohort instead of
// silently mixing with data the old formula produced. Bump this whenever
// scoreSpeciesDay's math changes in a way that shifts probabilities.
export const MODEL_VERSION = "1.2.0";

export interface Species {
  id: string;
  name_cz: string;
  name_latin: string;
  group: string;
  host_trees: string[];
  habitat: string;
  soil: string;
  moisture_need: "vysoká" | "střední" | string;
  temp_range_c: number[];
  days_after_rain: number[];
  min_rain_mm: number;
  season_months: number[];
  season_peak_months: number[];
  gbif_occurrence_count_cz: number;
  edibility: string;
  model_confidence: "vysoká" | "střední" | "nízká" | string;
  confidence_note: string;
}

export interface DayScore {
  date: string;
  probability_pct: number;
  factors: {
    season: number;
    temp: number;
    rain_timing: number;
    moisture: number;
    terrain: number;
    urban: number;
    days_since_rain: number | null;
  };
}

// Applied on top of terrainMatchFactor, not folded into it - a built-up
// area drags down every species, including saprotrophs that don't need a
// forest at all (bedla, václavka - see terrainMatchFactor's
// host_trees.length===0 case): even a mushroom that grows in plain grass
// isn't realistically growing on a train station concourse. Not a hard
// zero - a small park or garden can sit inside a landuse=residential
// polygon the 250m grid doesn't resolve, so a dramatic-but-nonzero
// penalty is the honest choice (explicit user direction, 2026-08-27).
const URBAN_PENALTY = 0.15;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function seasonFactor(month: number, species: Species): number {
  if (species.season_peak_months.includes(month)) return 1;
  if (species.season_months.includes(month)) return 0.6;
  return 0.05; // small residual - off-season stragglers do happen
}

function tempFactor(avgTempC: number, [tmin, tmax]: number[]): number {
  if (avgTempC >= tmin && avgTempC <= tmax) return 1;
  const dist = avgTempC < tmin ? tmin - avgTempC : avgTempC - tmax;
  return clamp(1 - dist / 8, 0, 1);
}

function rainTimingFactor(
  since: number | null,
  [dmin, dmax]: number[]
): number {
  if (since === null) return 0.1; // no qualifying rain found in lookback window
  if (since < dmin) return clamp(0.3 + (since / dmin) * 0.7, 0, 1); // too soon, ramping up
  if (since <= dmax) return 1;
  return clamp(1 - (since - dmax) * 0.08, 0.1, 1); // drying out
}

function moistureFactor(soilMoisturePct: number, need: string): number {
  const idealPct = need === "vysoká" ? 20 : need === "střední" ? 14 : 12;
  return clamp(soilMoisturePct / idealPct, 0, 1);
}

/**
 * Scores one species for one day in the fetched weather window.
 * `terrain` is looked up once per location (it doesn't change day to day)
 * and passed in - see api/forecast.ts.
 */
export function scoreSpeciesDay(
  days: DayWeather[],
  dayIndex: number,
  species: Species,
  terrain: TerrainInfo
): DayScore {
  const day = days[dayIndex];
  const month = Number(day.date.slice(5, 7));
  const since = daysSinceRain(days, dayIndex, species.min_rain_mm);

  const season = seasonFactor(month, species);
  const temp = tempFactor(day.tempAvgC, species.temp_range_c);
  const rain = rainTimingFactor(since, species.days_after_rain);
  const moisture = moistureFactor(day.soilMoisturePct, species.moisture_need);
  const terrainMatch = terrainMatchFactor(species.host_trees, terrain);
  const urban = terrain.isUrban ? URBAN_PENALTY : 1;

  // Season, terrain, and urban are hard gates (multiplied) - wrong forest,
  // wrong month, or a built-up area should crush the score, not just
  // nudge it. Temp/rain-timing/moisture are weighted-averaged so
  // decent-but-imperfect weather doesn't collapse to near-zero the way
  // multiplying three sub-1 factors would.
  const weighted = temp * 0.3 + rain * 0.4 + moisture * 0.3;
  const probability = clamp(
    Math.round(season * terrainMatch * urban * weighted * 100),
    0,
    100
  );

  return {
    date: day.date,
    probability_pct: probability,
    factors: {
      season: Math.round(season * 100) / 100,
      temp: Math.round(temp * 100) / 100,
      rain_timing: Math.round(rain * 100) / 100,
      moisture: Math.round(moisture * 100) / 100,
      terrain: Math.round(terrainMatch * 100) / 100,
      urban: Math.round(urban * 100) / 100,
      days_since_rain: since,
    },
  };
}
