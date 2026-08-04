import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWeather } from "./lib/weather";
import { scoreSpeciesDay, type Species } from "./lib/scoring";
import { fetchTerrain } from "./lib/terrain";
import speciesData from "./data/species.json";

/**
 * GET /api/forecast?lat=50.075&lon=14.44
 *
 * Real multi-factor probability per species, per day (yesterday through
 * +6 days forecast) — not a season-only lookup. Combines:
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
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = parseFloat(String(req.query.lat));
  const lon = parseFloat(String(req.query.lon));

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: "Chybí nebo je neplatné lat/lon." });
    return;
  }

  try {
    const [days, terrain] = await Promise.all([
      fetchWeather(lat, lon),
      fetchTerrain(lat, lon),
    ]);
    const species = speciesData.species as Species[];

    // Only score/output the recent-past + forecast window relevant to the
    // app (yesterday .. +6 days), even though `days` internally holds more
    // history for the days-since-rain lookback.
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIndex = days.findIndex((d) => d.date === todayStr);
    const outputStart = Math.max(0, todayIndex - 1);

    const result = species.map((sp) => ({
      id: sp.id,
      name_cz: sp.name_cz,
      name_latin: sp.name_latin,
      edibility: sp.edibility,
      model_confidence: sp.model_confidence,
      days: days
        .slice(outputStart)
        .map((_, offset) =>
          scoreSpeciesDay(days, outputStart + offset, sp, terrain)
        ),
    }));

    // Real day-level weather (not derived from the normalized 0-1 scoring
    // factors) — the UI needs actual °C / soil-moisture-% / rain-mm, not a
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
      terrain,
      weather,
      species: result,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Nepodařilo se spočítat předpověď.", detail: String(err) });
  }
}
