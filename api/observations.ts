import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";

/**
 * POST /api/observations
 * Body: { lat, lon, date, found, speciesIds?, note? }
 *
 * Lets someone confirm (or deny) that mushrooms were actually where the
 * app predicted them — the one signal the scoring model can never get from
 * weather/terrain data alone. Appended to a local JSONL file for now.
 *
 * Durability caveat: this is fine for dev-server.mjs, but Vercel's
 * serverless filesystem is ephemeral and often read-only in production —
 * a real deployment needs a real database (Vercel KV / Postgres / etc.)
 * before this is durable at any scale, let alone useful for retraining
 * anything. Login (to know *who* observed, not just what) is explicitly
 * future work per the product conversation — these records are anonymous
 * for now.
 */

const DATA_FILE = path.join(process.cwd(), "api", "data", "observations.jsonl");

interface ObservationBody {
  lat: number;
  lon: number;
  date: string;
  found: boolean;
  speciesIds?: string[];
  note?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as ObservationBody;
  if (
    typeof body?.lat !== "number" ||
    typeof body?.lon !== "number" ||
    typeof body?.date !== "string" ||
    typeof body?.found !== "boolean"
  ) {
    res.status(400).json({ error: "Chybí lat/lon/date/found." });
    return;
  }

  const record = {
    lat: body.lat,
    lon: body.lon,
    date: body.date,
    found: body.found,
    speciesIds: Array.isArray(body.speciesIds) ? body.speciesIds : [],
    note: body.note ?? null,
    recorded_at: new Date().toISOString(),
  };

  try {
    fs.appendFileSync(DATA_FILE, JSON.stringify(record) + "\n");
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Nepodařilo se uložit pozorování.", detail: String(err) });
  }
}
