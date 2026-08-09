import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/predict?lat=50.075&lon=14.44
 *
 * Fetches 30 days of precipitation + 7 days of temperature from Open-Meteo
 * (CHMI ALADIN model, no API key needed) and computes an API30-style
 * antecedent precipitation index the same way the CHMI mushroom map does:
 * a decay-weighted sum of daily rainfall, corrected for recent heat
 * (more evaporation = less "effective" moisture in hot months).
 *
 * This is the moisture half of the growth model. Species-specific
 * probability (host tree match, soil pH, season) is not computed here yet
 * - this endpoint only answers "how wet has the ground been lately".
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// Antecedent Precipitation Index decay constant. 0.9 is a common default in
// hydrology literature; needs calibration against real NDOP finds later.
const API_DECAY = 0.9;

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

function computeApi30(precipLast30: number[]): number {
  // precipLast30[last] = today, precipLast30[0] = 29 days ago.
  let api = 0;
  const n = precipLast30.length;
  for (let i = 0; i < n; i++) {
    const daysAgo = n - 1 - i;
    api += precipLast30[i] * Math.pow(API_DECAY, daysAgo);
  }
  return Math.round(api * 10) / 10;
}

function computeTempCorrection(avgTemp7d: number): number {
  // Heuristic first pass: above ~15°C avg, evaporation eats into effective
  // moisture; below it, cool weather preserves it. Clamped so it can never
  // zero out or blow up the index. Needs real calibration later.
  const factor = 1 - (avgTemp7d - 15) * 0.03;
  return Math.min(1.15, Math.max(0.4, Math.round(factor * 100) / 100));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = parseFloat(String(req.query.lat));
  const lon = parseFloat(String(req.query.lon));

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: "Chybí nebo je neplatné lat/lon." });
    return;
  }

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "precipitation_sum,temperature_2m_max,temperature_2m_min"
  );
  url.searchParams.set("past_days", "30");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "Europe/Prague");

  try {
    const weatherRes = await fetch(url.toString());
    if (!weatherRes.ok) {
      res.status(502).json({ error: "Open-Meteo API selhalo." });
      return;
    }
    const weather = (await weatherRes.json()) as OpenMeteoDailyResponse;

    const precip30 = weather.daily.precipitation_sum.slice(-30);
    const tmax7 = weather.daily.temperature_2m_max.slice(-7);
    const tmin7 = weather.daily.temperature_2m_min.slice(-7);

    const avgTemp7d =
      tmax7.reduce((sum, tmax, i) => sum + (tmax + tmin7[i]) / 2, 0) /
      tmax7.length;

    const api30 = computeApi30(precip30);
    const tempCorrection = computeTempCorrection(avgTemp7d);
    const correctedIndex = Math.round(api30 * tempCorrection * 10) / 10;

    res.status(200).json({
      location: { lat, lon },
      api30,
      avgTemp7d: Math.round(avgTemp7d * 10) / 10,
      tempCorrection,
      correctedIndex,
      note: "Sezónní koeficient a shoda s dřevinami/půdou zatím chybí - přidá se ve species-condition vrstvě.",
    });
  } catch (err) {
    res.status(500).json({ error: "Nepodařilo se spočítat index.", detail: String(err) });
  }
}
