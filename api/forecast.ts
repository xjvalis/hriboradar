import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWeather, fetchCurrentConditions } from "../lib/weather";
import { scoreSpeciesDay, MODEL_VERSION, type Species } from "../lib/scoring";
import { fetchTerrain } from "../lib/terrain";
import { applyCalibratedProbability } from "../lib/calibration";
import { parseLatLon } from "../lib/validate";
import speciesData from "./data/species.json";

/**
 * GET /api/forecast?lat=50.075&lon=14.44
 *
 * Real multi-factor probability per species, per day (yesterday through
 * +6 days forecast) - not a season-only lookup. Combines:
 *   - season (species.json season_months/season_peak_months)
 *   - recent temperature vs species.json temp_range_c
 *   - days since a qualifying rain vs species.json days_after_rain
 *   - actual soil moisture % (Open-Meteo soil_moisture_3_to_9cm)
 *   - forest composition nearby vs species.json host_trees (OSM/ÚHÚL import)
 *
 * This is what both the map ("what's growing right now") and the atlas
 * ("today's % per species, click in for conditions") should call. The
 * +N day entries are what the "za 5 dní by mohly růst..." notification
 * job should scan for threshold crossings.
 *
 * `weather[].tempC` is a daily avg(max,min) - the right input for the
 * model (mushroom growth responds to the day, not the instant), but the
 * wrong thing to show next to "right now" on the UI, which on a hot day
 * can genuinely be 5-6°C off from that average. `current` is the actual
 * live reading for exactly that purpose; may be null if Open-Meteo's
 * current-conditions endpoint failed (not worth failing the whole
 * request over).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsed = parseLatLon(req.query);
  if (!parsed) {
    res.status(400).json({ error: "Chybí nebo je neplatné lat/lon." });
    return;
  }
  const { lat, lon } = parsed;

  try {
    const [days, terrain, current] = await Promise.all([
      fetchWeather(lat, lon),
      fetchTerrain(lat, lon),
      fetchCurrentConditions(lat, lon).catch(() => null), // "right now" is a nice-to-have, not worth failing the whole request over
    ]);
    const species = speciesData.species as Species[];

    // Only score/output the recent-past + forecast window relevant to the
    // app (yesterday .. +6 days), even though `days` internally holds more
    // history for the days-since-rain lookback.
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIndex = days.findIndex((d) => d.date === todayStr);
    const outputStart = Math.max(0, todayIndex - 1);

    // probability_pct gets nudged by the calibration layer (see
    // lib/calibration.ts) once enough real "did you find it" feedback
    // exists for that species/probability range - falls back to the raw
    // score untouched otherwise, which is always true until feedback starts
    // accumulating. `factors` stays the raw, uncalibrated sub-scores; those
    // are diagnostic, not what's shown to the user.
    const result = await Promise.all(
      species.map(async (sp) => ({
        id: sp.id,
        name_cz: sp.name_cz,
        name_latin: sp.name_latin,
        edibility: sp.edibility,
        model_confidence: sp.model_confidence,
        days: await Promise.all(
          days.slice(outputStart).map(async (_, offset) => {
            const raw = scoreSpeciesDay(days, outputStart + offset, sp, terrain);
            const probability_pct = await applyCalibratedProbability(raw.probability_pct, sp.id);
            return { ...raw, probability_pct };
          })
        ),
      }))
    );

    // Real day-level weather (not derived from the normalized 0-1 scoring
    // factors) - the UI needs actual °C / soil-moisture-% / rain-mm, not a
    // back-computed approximation of them.
    const weather = days.slice(outputStart).map((d) => ({
      date: d.date,
      tempC: Math.round(d.tempAvgC * 10) / 10,
      soilMoisturePct: d.soilMoisturePct,
      precipMm: d.precipMm,
    }));

    res.status(200).json({
      location: { lat, lon },
      generated_at: new Date().toISOString(),
      today: todayStr,
      model_version: MODEL_VERSION,
      terrain,
      current,
      weather,
      species: result,
    });
  } catch (err) {
    // Logged server-side for debugging, not sent to the client - a raw
    // exception string can leak internal paths/stack details (OWASP API
    // security: verbose error responses), and isn't actionable for the
    // app anyway beyond "something failed."
    console.error("forecast handler error:", err);
    res.status(500).json({ error: "Nepodařilo se spočítat předpověď." });
  }
}
