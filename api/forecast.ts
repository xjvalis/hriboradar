import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { fetchWeather } from "../lib/weather";
import { scoreSpeciesDay, MODEL_VERSION, type Species } from "../lib/scoring";
import { fetchTerrain } from "../lib/terrain";
import { applyCalibratedProbability } from "../lib/calibration";
import { parseLatLon } from "../lib/validate";
import speciesData from "./data/species.json";

// Whether this call is coming from a Plus subscriber - the 7-day forecast
// is a paid feature (free tier: today only), but until this existed that
// limit was enforced purely in the app's own UI, so anyone calling this
// endpoint directly got the full 7 days for free regardless of
// subscription status (found 2026-09-09, auditing "no bypassing the
// system" ahead of launch). Uses the caller's own access token against
// RLS (same anon-client pattern as api/account-delete.ts), never the
// service_role key - a missing/invalid/expired token just reads as free
// tier, same as an anonymous visitor.
async function isPremiumCaller(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  try {
    const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await authed.auth.getUser();
    if (!userData.user) return false;
    const { data } = await authed
      .from("hriboradar_subscriptions")
      .select("status")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    return data?.status === "active" || data?.status === "trial";
  } catch {
    return false;
  }
}

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
 * `current` is always null - it used to be a live "right now" Open-Meteo
 * reading, dropped 2026-09-03. The scoring model only ever consumed daily
 * avg(max,min) (mushroom growth responds to the day, not the instant), so
 * that live call bought nothing but a UI nicety, at the cost of exactly
 * the kind of per-request Open-Meteo dependency the rest of this file no
 * longer has (see lib/weather.ts's fetchWeather). The mobile client
 * already falls back to `weather[].tempC` with a "Průměrná denní teplota"
 * label whenever `current` is null - see HomeScreen.tsx/PredpovedScreen.tsx.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsed = parseLatLon(req.query);
  if (!parsed) {
    res.status(400).json({ error: "Chybí nebo je neplatné lat/lon." });
    return;
  }
  const { lat, lon } = parsed;

  try {
    const [days, terrain, premium] = await Promise.all([
      fetchWeather(lat, lon),
      fetchTerrain(lat, lon),
      isPremiumCaller(req.headers.authorization),
    ]);
    const current = null;
    const species = speciesData.species as Species[];

    // Only score/output the recent-past + forecast window relevant to the
    // app (yesterday .. +6 days), even though `days` internally holds more
    // history for the days-since-rain lookback.
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIndex = days.findIndex((d) => d.date === todayStr);
    const outputStart = Math.max(0, todayIndex - 1);
    // Free tier: yesterday + today only, no forecast days - matches what
    // the app's own paywall already advertises. Applied by slicing the
    // already-scored output below rather than shortening `days.slice(
    // outputStart)` above, since scoreSpeciesDay's days-since-rain lookback
    // still needs the full history regardless of who's asking.
    const freeTierCutoff = todayIndex - outputStart + 1;

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
      weather: premium ? weather : weather.slice(0, freeTierCutoff),
      species: premium ? result : result.map((sp) => ({ ...sp, days: sp.days.slice(0, freeTierCutoff) })),
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
