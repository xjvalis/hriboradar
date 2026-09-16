import type { DayWeather } from "./weather";
import { daysSinceRain } from "./weather";
import { terrainMatchFactor, type TerrainInfo } from "./terrain";

// Stamped on every feedback row and calibration-stats bucket (see
// api/feedback.ts, api/cron/recalibrate.ts) so a future change to the
// scoring formula below starts its own calibration cohort instead of
// silently mixing with data the old formula produced. Bump this whenever
// scoreSpeciesDay's math changes in a way that shifts probabilities -
// including a species.json data correction (host_trees/temp_range_c/season),
// even though scoreSpeciesDay's own code didn't change, since the inputs
// feeding it materially shifted (see api/data/species.json's own
// mycology_audit_2026-09-16 _meta entry for what changed and why).
export const MODEL_VERSION = "1.9.0";

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

// Hard ceiling on any number actually shown to a user, on top of the
// asymptotic curves above already making literal 100% mathematically
// near-impossible - explicit product decision (2026-09-02), not a math
// fix: even a forecast that's genuinely as good as this model gets
// shouldn't visibly claim certainty. Applied at the two points every
// user-facing percentage in the app derives from (weatherPotential and
// scoreSpeciesDay's `probability` below) - everything downstream (the map,
// Domů's daily index, "Všechny houby") only ever averages or multiplies
// these by factors <=1, so capping here propagates everywhere without
// needing a second clamp at each call site.
const MAX_DISPLAY_PCT = 95;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Continuous month position (e.g. Sept 16 -> ~9.5) instead of a bare
// integer month, so seasonFactor below can produce a smooth curve with no
// day-to-day cliff - the old version jumped straight from 0.05 to 0.6 the
// instant the calendar crossed into a new month (found 2026-09-16: real
// mycelium doesn't know what day it is, and the user rightly pointed out
// Aug 31 vs Sept 1 shouldn't swing a forecast that hard on its own).
function monthPosition(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return month + (day - 1) / daysInMonth;
}

// Extra span (in months) added past season_months' own edge before the
// curve reaches SEASON_RESIDUAL - without this, a species with a wide
// shoulder between its peak and its season_months edge (e.g. hřib smrkový:
// season=[6..11], peak=[9,10], a 3-month shoulder before the peak) would
// hit the residual floor exactly AT the season boundary (1 June), reading
// no better there than deep midwinter - the whole shoulder would get
// consumed by the descent with nothing left over, collapsing "just
// entering the season" and "genuinely out of season" into the same value.
// Adding this tail keeps a real gradient across the season_months boundary
// itself instead of flattening out right at it.
const SEASON_TAIL_MONTHS = 1.5;
// Same floor the old 3-bucket version used outside season_months - genuine
// off-season stragglers do happen, so never quite zero.
const SEASON_RESIDUAL = 0.05;

// Reworked 2026-09-16 (see monthPosition's comment) from a 3-bucket step
// function (peak=1, in-season=0.6, else=0.05, jumping at each month
// boundary) into one continuous raised-cosine curve: 1.0 across
// season_peak_months, then a smooth descent to SEASON_RESIDUAL spread over
// the real shoulder between the peak and season_months' own edge plus
// SEASON_TAIL_MONTHS beyond it (see that constant's comment for why the
// extra span matters). Deliberately a single unbroken curve rather than a
// "ramp to an edge value, then a separate tail" two-phase shape - an
// earlier version had a seam exactly where the two phases met, which
// produced its own mini-cliff whenever the ramp phase was thin (notably
// species like čirůvka fialová whose peak starts exactly where
// season_months starts, leaving no shoulder at all on that side). Still a
// real gate, not a suggestion: a strictly spring species like smrž obecný
// (season_months Mar-May only) still reads near SEASON_RESIDUAL in
// September regardless of how ideal that week's temp/rain look - the
// curve changes how smoothly it approaches that floor, not whether it
// does. Doesn't handle a season/peak spanning the calendar year boundary
// (e.g. Nov-Jan) - none of the current species need that, so unhandled
// rather than half-tested.
function seasonFactor(dateStr: string, species: Species): number {
  const pos = monthPosition(dateStr);
  const peakStart = Math.min(...species.season_peak_months);
  const peakEnd = Math.max(...species.season_peak_months) + 1; // exclusive
  const seasonStart = Math.min(...species.season_months);
  const seasonEnd = Math.max(...species.season_months) + 1; // exclusive

  const center = (peakStart + peakEnd) / 2;
  const peakHalfWidth = (peakEnd - peakStart) / 2;
  const d = pos - center;
  const dist = Math.abs(d);
  if (dist <= peakHalfWidth) return 1;

  const shoulder = Math.max(0, (d < 0 ? center - seasonStart : seasonEnd - center) - peakHalfWidth);
  const decaySpan = shoulder + SEASON_TAIL_MONTHS;
  const t = Math.min(1, (dist - peakHalfWidth) / decaySpan);
  return SEASON_RESIDUAL + (1 - SEASON_RESIDUAL) * 0.5 * (1 + Math.cos(Math.PI * t));
}

// Shared design point for every continuous weather factor below (2026-09-01
// rework): the old versions were flat plateaus - "1.0 anywhere inside the
// ideal range/window", "1.0 once past the ideal threshold and flat forever
// after". Under real conditions that plateau is easy to land on (a single
// big rain event, a mild September day) and every factor pinning to
// literal 1.0 at once produces a literal 100% forecast - a claim of
// certainty no honest biological model should make. EDGE_FACTOR (temp/rain
// timing) and the asymptotic `saturating()` curve (moisture) both replace
// "flat 1.0 region" with "peaks near but never at 1.0, keeps differentiating
// past the old threshold" - a genuinely better day still scores higher than
// a merely adequate one, and no combination of real inputs can multiply out
// to exactly 100%.
const EDGE_FACTOR = 0.8; // factor value at the boundary of an ideal range/window - still a good day, just not the literal optimum

function tempFactor(avgTempC: number, [tmin, tmax]: number[]): number {
  const mid = (tmin + tmax) / 2;
  const halfRange = (tmax - tmin) / 2;
  if (halfRange <= 0) {
    return avgTempC === tmin ? 1 : clamp(1 - Math.abs(avgTempC - tmin) / 8, 0, 1);
  }
  const d = Math.abs(avgTempC - mid);
  if (d <= halfRange) {
    // Raised cosine: 1.0 at the range's center, EDGE_FACTOR right at tmin/tmax.
    return EDGE_FACTOR + (1 - EDGE_FACTOR) * 0.5 * (1 + Math.cos((Math.PI * d) / halfRange));
  }
  return clamp(EDGE_FACTOR - (d - halfRange) / 8, 0, 1);
}

function rainTimingFactor(
  since: number | null,
  [dmin, dmax]: number[]
): number {
  if (since === null) return 0.1; // no qualifying rain found in lookback window
  const mid = (dmin + dmax) / 2;
  const halfRange = (dmax - dmin) / 2;
  if (halfRange <= 0) {
    return since === dmin ? 1 : clamp(EDGE_FACTOR - Math.abs(since - dmin) * 0.08, 0.1, EDGE_FACTOR);
  }
  const d = Math.abs(since - mid);
  if (d <= halfRange) {
    return EDGE_FACTOR + (1 - EDGE_FACTOR) * 0.5 * (1 + Math.cos((Math.PI * d) / halfRange));
  }
  if (since < dmin) return clamp(0.3 + (since / dmin) * (EDGE_FACTOR - 0.3), 0, EDGE_FACTOR); // too soon, ramping up
  return clamp(EDGE_FACTOR - (since - dmax) * 0.08, 0.1, EDGE_FACTOR); // drying out
}

// Asymptotic approach to 1 rather than a linear ramp to a hard ceiling -
// reaching `target` (the old idealPct/idealMm threshold) now reads as a
// solid 0.85, not "done, maxed out forever". Meaningfully more rain/soil
// moisture past that point still keeps nudging the score up (a proper
// saturating response curve, the same shape ecological niche models use
// for a resource that helps up to a point and then has diminishing
// returns), rather than being indistinguishable from "just barely enough".
function saturating(x: number, target: number, targetFactor = 0.85): number {
  if (target <= 0) return x > 0 ? 1 : 0;
  const k = target / -Math.log(1 - targetFactor);
  return 1 - Math.exp(-x / k);
}

function soilMoistureFactor(soilMoisturePct: number, need: string): number {
  const idealPct = need === "vysoká" ? 20 : need === "střední" ? 14 : 12;
  return saturating(soilMoisturePct, idealPct);
}

// idealMm thresholds for the decay-weighted net-water index
// (lib/weather.ts's antecedentWaterMm - rain minus real ET0
// evapotranspiration, ANTECEDENT_DECAY=0.9 over 30 days) - same role as
// soilMoistureFactor's idealPct, but scaled to "effective mm of
// accumulated water" instead of volumetric soil-moisture %. Order of
// magnitude estimated from typical central European growing-season net
// water balance, not measured against real ground truth - this app's
// calibration loop (api/cron/recalibrate.ts) corrects residual bias once
// feedback accumulates under this MODEL_VERSION. A single large storm
// (e.g. 40-50mm) can still push effectiveMm to 2-3x idealMm - saturating()
// lets that read as meaningfully wetter (~0.9-0.95) than a day that just
// barely cleared the threshold (~0.85), instead of both being
// indistinguishable flat 1.0s the way a linear-clamp version would.
function antecedentFactor(effectiveMm: number, need: string): number {
  const idealMm = need === "vysoká" ? 16 : need === "střední" ? 11 : 8;
  return saturating(Math.max(0, effectiveMm), idealMm);
}

// The moisture signal blends two genuinely different things rather than
// picking one: the decay-weighted net-water index carries the multi-week
// "memory" ČHMI's API30 has and a same-day-only snapshot doesn't (a single
// wet day after a dry August could otherwise saturate a naive factor to
// 1.0 even though the antecedent month was dry). The same-day modeled soil
// moisture stays in the blend rather than being replaced outright - the
// mushroom-yield literature (e.g. Mediterranean pine sporocarp studies)
// found remote-sensed soil moisture rivals raw precipitation as a
// predictor on its own, so dropping it would throw away a real
// independent signal, not just redundant noise.
function moistureFactor(day: DayWeather, need: string): number {
  const antecedent = antecedentFactor(day.antecedentWaterMm, need);
  const soil = soilMoistureFactor(day.soilMoisturePct, need);
  return clamp(antecedent * 0.55 + soil * 0.45, 0, 1);
}

interface WeatherFactors {
  season: number;
  temp: number;
  rain: number;
  moisture: number;
  weighted: number; // temp/rain/moisture combined, before the season gate
  daysSinceRainValue: number | null;
}

// Everything about a species/day score that depends only on weather + the
// calendar - no terrain, no location at all. Split out from scoreSpeciesDay
// so the map overview (lib/grid.ts) can interpolate *this* part smoothly
// across its sparse ~15km sample grid (weather genuinely doesn't change
// sharply over a few km) while applying each real forest polygon's own
// exact terrain match separately and precisely (see MAP_SAMPLE_RADIUS_CELLS's
// comment in lib/terrain.ts for the bug this fixes: blending terrain into
// the same sparse interpolation made forest 5km away get credited to a
// point that isn't actually forested, so a pulsing "look here" hotspot
// could sit right next to a spot that - tapped precisely - read 28%).
function weatherFactors(days: DayWeather[], dayIndex: number, species: Species): WeatherFactors {
  const day = days[dayIndex];
  const since = daysSinceRain(days, dayIndex, species.min_rain_mm);

  const season = seasonFactor(day.date, species);
  const temp = tempFactor(day.tempAvgC, species.temp_range_c);
  const rain = rainTimingFactor(since, species.days_after_rain);
  const moisture = moistureFactor(day, species.moisture_need);
  // rain_timing used to carry the most weight (0.4) of the three - but it's
  // a near-binary "was there a single qualifying rain event recently"
  // signal, while moisture (soil moisture + the decay-weighted antecedent
  // index) is the closer physiological driver mycology research actually
  // points to (spores stay dormant until soil wetness crosses a threshold,
  // and fruiting is sustained by ongoing moisture, not just the presence of
  // one trigger event - see the sources gathered 2026-09-15 investigating
  // why a region with steady month-long rain scored worse than one with a
  // single recent storm). Moisture now carries the larger share instead.
  const weighted = temp * 0.3 + rain * 0.3 + moisture * 0.4;

  return { season, temp, rain, moisture, weighted, daysSinceRainValue: since };
}

/**
 * The weather-only potential (0-100) for one species/day, ignoring terrain
 * entirely - what lib/grid.ts's sparse sample grid stores per point, later
 * combined with a specific location's own precise terrain (see comment on
 * weatherFactors above).
 */
export function weatherPotential(days: DayWeather[], dayIndex: number, species: Species): number {
  const f = weatherFactors(days, dayIndex, species);
  return clamp(Math.round(f.season * f.weighted * 100), 0, MAX_DISPLAY_PCT);
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
  const f = weatherFactors(days, dayIndex, species);
  const terrainMatch = terrainMatchFactor(species.host_trees, terrain);
  const urban = terrain.isUrban ? URBAN_PENALTY : 1;

  // Season, terrain, and urban are multiplied in (not blended) - wrong
  // forest, wrong month, or a built-up area should dominate the score, not
  // just nudge it. "Multiplicative penalty" rather than literal "hard
  // gate" though: season keeps a 0.05 residual for off-season stragglers,
  // and terrainMatchFactor keeps 0.1-0.85 residuals for every case except
  // literally no forest at all nearby - only that case and isUrban really
  // are near-zero. Temp/rain-timing/moisture are weighted-averaged instead
  // of multiplied so decent-but-imperfect weather doesn't collapse to
  // near-zero the way multiplying three sub-1 factors would.
  const probability = clamp(
    Math.round(f.season * terrainMatch * urban * f.weighted * 100),
    0,
    MAX_DISPLAY_PCT
  );

  return {
    date: days[dayIndex].date,
    probability_pct: probability,
    factors: {
      season: Math.round(f.season * 100) / 100,
      temp: Math.round(f.temp * 100) / 100,
      rain_timing: Math.round(f.rain * 100) / 100,
      moisture: Math.round(f.moisture * 100) / 100,
      terrain: Math.round(terrainMatch * 100) / 100,
      urban: Math.round(urban * 100) / 100,
      days_since_rain: f.daysSinceRainValue,
    },
  };
}
