import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { fetchWeather } from "./lib/weather";
import { fetchTerrain } from "./lib/terrain";
import { scoreSpeciesDay, MODEL_VERSION, type Species } from "./lib/scoring";
import speciesData from "./data/species.json";

// Species the model already considered negligible that day carry no
// calibration signal either way - skip writing a row for them so the table
// doesn't fill up with thousands of "predicted 2%, not found" non-events.
const MIN_QUALIFYING_PCT = 10;

interface FeedbackBody {
  lat: number;
  lon: number;
  targetDate: string; // YYYY-MM-DD - must be today or yesterday, see below
  found: boolean;
  speciesIds: string[]; // species explicitly marked as found; must be [] when found is false
  quantityBucket: "few" | "basket" | "lots" | null;
}

/**
 * POST /api/feedback - "did what the model predicted actually happen?"
 *
 * predicted_probability/factors/model_version are always recomputed here,
 * server-side, from the same historical weather Open-Meteo already served
 * for targetDate (immutable once the date is in the past) - never trusted
 * from the request body. Otherwise a client could submit an arbitrary
 * "the model said 95%" alongside a real "not found" and quietly poison
 * calibration for every user of that species.
 *
 * Written with the caller's own Supabase access token (not the service
 * role), so Postgres RLS - not this handler - is what actually stops one
 * user from writing rows under another user's id.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Chybí přihlášení." });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    res.status(500).json({ error: "Supabase není nakonfigurované." });
    return;
  }

  const body = req.body as Partial<FeedbackBody>;
  const { lat, lon, targetDate, found, speciesIds, quantityBucket } = body;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    typeof targetDate !== "string" ||
    typeof found !== "boolean" ||
    !Array.isArray(speciesIds)
  ) {
    res.status(400).json({ error: "Neplatná data." });
    return;
  }

  // Keeps the "time window" simple (section 5 of the design: no calendar
  // picker) and guarantees fetchWeather's fixed past_days window always
  // covers targetDate, so the lookup below can't come back empty.
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (targetDate !== today && targetDate !== yesterday) {
    res.status(400).json({ error: "Zpětnou vazbu lze dát jen za dnešek nebo včerejšek." });
    return;
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    res.status(401).json({ error: "Neplatné přihlášení." });
    return;
  }

  try {
    const [days, terrain] = await Promise.all([fetchWeather(lat, lon), fetchTerrain(lat, lon)]);
    const dayIndex = days.findIndex((d) => d.date === targetDate);
    if (dayIndex === -1) {
      res.status(400).json({ error: "Pro tento den už nemáme data o počasí." });
      return;
    }

    const species = speciesData.species as Species[];
    const rows = species
      .map((sp) => ({ sp, score: scoreSpeciesDay(days, dayIndex, sp, terrain) }))
      .filter(({ score }) => score.probability_pct >= MIN_QUALIFYING_PCT)
      .map(({ sp, score }) => {
        const wasFound = found && speciesIds.includes(sp.id);
        return {
          species_id: sp.id,
          lat,
          lon,
          target_date: targetDate,
          observed_at: targetDate,
          found: wasFound,
          quantity_bucket: wasFound ? quantityBucket ?? null : null,
          predicted_probability: score.probability_pct,
          factors: score.factors,
          model_version: MODEL_VERSION,
        };
      });

    if (rows.length === 0) {
      res.status(200).json({ ok: true, rows_written: 0 });
      return;
    }

    const { error: upsertError } = await supabase
      .from("rostou_feedback")
      .upsert(rows, { onConflict: "user_id,species_id,lat,lon,target_date" });

    if (upsertError) {
      console.error("feedback upsert error:", upsertError);
      res.status(500).json({ error: "Nepodařilo se uložit zpětnou vazbu." });
      return;
    }

    res.status(200).json({ ok: true, rows_written: rows.length });
  } catch (err) {
    console.error("feedback handler error:", err);
    res.status(500).json({ error: "Nepodařilo se uložit zpětnou vazbu." });
  }
}
