import { cached, roundCoord } from "./cache";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
// No default fetch timeout exists in Node/the Vercel runtime - a hung
// connection would otherwise sit there until the platform's own function
// timeout kills the whole request (a hard, ungraceful cutoff, not
// something fetchWithRetry below gets a chance to react to). Same pattern
// api/geocode.ts already uses for its Nominatim calls.
const FETCH_TIMEOUT_MS = 8000;

// How far back we look for a "qualifying rain" event when computing
// days-since-rain, and for the antecedent-precipitation decay window below.
// Must cover both the largest days_after_rain window in species.json
// (currently max 14) and the 30-day antecedent-precipitation index with
// margin for its own decay tail.
const PAST_DAYS = 35;

// Recession constant for the antecedent precipitation index (see
// antecedentPrecip below) - each day back contributes ANTECEDENT_DECAY^n of
// its rainfall. 0.9 sits in the middle of the 0.85-0.98 range typically used
// for API-type indices (see e.g. the "estimation of soil moisture using
// modified antecedent precipitation index" literature); ČHMI's own API30
// (the model this mirrors - "sumace denních úhrnů srážek za sledované
// období s klesající vahou směrem do minulosti") doesn't publish its exact
// constant, so this is a reasonable literature-typical default rather than
// a reproduction of their tuned value. Downstream calibration
// (api/cron/recalibrate.ts) corrects for whatever bias this introduces once
// real feedback accumulates under lib/scoring.ts's MODEL_VERSION.
const ANTECEDENT_DECAY = 0.9;
const ANTECEDENT_WINDOW_DAYS = 30;
// How far forward we forecast - covers the "za N dní upozornění" use case.
const FORECAST_DAYS = 7;
// Weather changes slowly relative to our daily-resolution model - safe to
// cache for a while, and it's what stops the Home screen's 8 region calls
// from re-fetching the same forecast on every load.
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
// "Right now" is a different question from the daily avg(max,min) the
// model runs on - on a hot day the two can differ by 5-6°C - so it gets
// its own short-lived cache rather than reusing the daily one.
const CURRENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export interface DayWeather {
  date: string; // YYYY-MM-DD
  precipMm: number;
  tempAvgC: number;
  soilMoisturePct: number; // volumetric water content 0-9cm depth, as %
  antecedentWaterMm: number; // 30-day decay-weighted (precip - ET0) sum, see ANTECEDENT_DECAY
  isForecast: boolean;
}

export interface CurrentConditions {
  tempC: number;
  precipMm: number; // in the current ~15-min interval, not a daily total
  time: string;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    et0_fao_evapotranspiration: number[];
  };
  hourly: {
    time: string[];
    soil_moisture_3_to_9cm: number[];
  };
}

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    temperature_2m: number;
    precipitation: number;
  };
}

export function fetchWeather(lat: number, lon: number): Promise<DayWeather[]> {
  const key = `weather:${roundCoord(lat)},${roundCoord(lon)}`;
  return cached(key, WEATHER_CACHE_TTL_MS, () => fetchWeatherUncached(lat, lon));
}

// A transient Open-Meteo hiccup (rate limit, one dropped connection) used
// to surface immediately as this app's own red error banner - most
// visible right after opening the app, when Domů fires ~9 concurrent
// /api/forecast calls at once (the user's own location + all 8 "Kam dnes?"
// regions) and lib/grid.ts's map fires ~350 for the same reason. Retrying
// here, in the one place every caller (api/forecast.ts, lib/grid.ts,
// api/feedback.ts) already goes through via fetchWeather, means a single
// bad request self-heals instead of failing the whole screen - found
// 2026-09-02, previously only lib/grid.ts had its own local copy of this.
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchWeatherUncached(lat: number, lon: number): Promise<DayWeather[]> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration"
  );
  url.searchParams.set("hourly", "soil_moisture_3_to_9cm");
  url.searchParams.set("past_days", String(PAST_DAYS));
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("timezone", "Europe/Prague");

  const res = await fetchWithRetry(url.toString());
  const data = (await res.json()) as OpenMeteoResponse;

  // Bucket hourly soil moisture into daily averages by date prefix.
  const soilByDate = new Map<string, number[]>();
  data.hourly.time.forEach((ts, i) => {
    const date = ts.slice(0, 10);
    const val = data.hourly.soil_moisture_3_to_9cm[i];
    if (val == null) return;
    if (!soilByDate.has(date)) soilByDate.set(date, []);
    soilByDate.get(date)!.push(val);
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  // Decay-weighted sum of the trailing ANTECEDENT_WINDOW_DAYS of NET water
  // (rain minus real evapotranspiration, not just rain) - each day nets its
  // own precipitation against Open-Meteo's et0_fao_evapotranspiration (the
  // standard FAO-56 Penman-Monteith reference value: temperature, humidity,
  // wind and solar radiation combined), before decaying into the running
  // sum. This replaced a cruder version (decay raw rain, then separately
  // multiply the whole sum by a linear guess from 7-day avg temp) - that
  // guess was admittedly a simplification of exactly this ET0 model, and
  // ET0 is already sitting right there in the same API response. Can go
  // negative (net water deficit on a long hot dry stretch) - deliberately
  // not floored at 0 per-day so a genuinely parched multi-week stretch
  // shows as a real deficit, not just "zero contribution"; lib/scoring.ts's
  // saturating() floors the final index at 0 for the probability curve.
  function antecedentWaterAt(i: number): number {
    let sum = 0;
    for (let j = 0; j <= ANTECEDENT_WINDOW_DAYS && i - j >= 0; j++) {
      const net = (data.daily.precipitation_sum[i - j] ?? 0) - (data.daily.et0_fao_evapotranspiration[i - j] ?? 0);
      sum += net * ANTECEDENT_DECAY ** j;
    }
    return Math.round(sum * 10) / 10;
  }

  return data.daily.time.map((date, i) => {
    const soilValues = soilByDate.get(date) ?? [];
    const soilAvg =
      soilValues.length > 0
        ? soilValues.reduce((a, b) => a + b, 0) / soilValues.length
        : 0;
    return {
      date,
      precipMm: data.daily.precipitation_sum[i] ?? 0,
      tempAvgC:
        (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2,
      antecedentWaterMm: antecedentWaterAt(i),
      soilMoisturePct: Math.round(soilAvg * 1000) / 10, // m3/m3 -> %
      isForecast: date > todayStr,
    };
  });
}

export function fetchCurrentConditions(lat: number, lon: number): Promise<CurrentConditions> {
  const key = `current:${roundCoord(lat)},${roundCoord(lon)}`;
  return cached(key, CURRENT_CACHE_TTL_MS, () => fetchCurrentConditionsUncached(lat, lon));
}

async function fetchCurrentConditionsUncached(lat: number, lon: number): Promise<CurrentConditions> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,precipitation");
  url.searchParams.set("timezone", "Europe/Prague");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Open-Meteo current-conditions request failed: ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoCurrentResponse;
  return {
    tempC: Math.round(data.current.temperature_2m * 10) / 10,
    precipMm: data.current.precipitation,
    time: data.current.time,
  };
}

/**
 * Days since the most recent "qualifying rain" (rolling 2-day precip sum
 * >= minRainMm), looking back from `dayIndex` in `days`. Returns null if no
 * qualifying rain is found within the fetched window.
 */
export function daysSinceRain(
  days: DayWeather[],
  dayIndex: number,
  minRainMm: number
): number | null {
  for (let i = dayIndex; i >= 1; i--) {
    const twoDaySum = days[i].precipMm + days[i - 1].precipMm;
    if (twoDaySum >= minRainMm) {
      return dayIndex - i;
    }
  }
  return null;
}
