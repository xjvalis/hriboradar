import { cached, roundCoord } from "./cache";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// How far back we look for a "qualifying rain" event when computing
// days-since-rain. Must cover the largest days_after_rain window in
// species.json (currently max 14) with margin.
const PAST_DAYS = 16;
// How far forward we forecast — covers the "za N dní upozornění" use case.
const FORECAST_DAYS = 7;
// Weather changes slowly relative to our daily-resolution model — safe to
// cache for a while, and it's what stops the Home screen's 8 region calls
// from re-fetching the same forecast on every load.
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
// "Right now" is a different question from the daily avg(max,min) the
// model runs on — on a hot day the two can differ by 5-6°C — so it gets
// its own short-lived cache rather than reusing the daily one.
const CURRENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export interface DayWeather {
  date: string; // YYYY-MM-DD
  precipMm: number;
  tempAvgC: number;
  soilMoisturePct: number; // volumetric water content 0-9cm depth, as %
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

async function fetchWeatherUncached(lat: number, lon: number): Promise<DayWeather[]> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "precipitation_sum,temperature_2m_max,temperature_2m_min"
  );
  url.searchParams.set("hourly", "soil_moisture_3_to_9cm");
  url.searchParams.set("past_days", String(PAST_DAYS));
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("timezone", "Europe/Prague");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status}`);
  }
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

  const res = await fetch(url.toString());
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
