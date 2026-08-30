import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface PushTokenBody {
  token: string;
  platform: "ios" | "android";
}

/**
 * POST /api/push-token - registers this device's Expo push token against
 * the signed-in user, so api/cron/watchdog.ts can find it later. Called
 * from mobile/src/PushNotificationContext.tsx once permission is granted.
 *
 * Same auth pattern as api/feedback.ts: the caller's own Supabase access
 * token (not the service role), so Postgres RLS - not this handler - is
 * what actually stops one user from writing a token row under another
 * user's id.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
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

  const body = req.body as Partial<PushTokenBody>;
  const { token, platform } = body;
  if (typeof token !== "string" || !token || (platform !== "ios" && platform !== "android")) {
    res.status(400).json({ error: "Neplatná data." });
    return;
  }

  const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    res.status(401).json({ error: "Neplatné přihlášení." });
    return;
  }

  // onConflict:"token" (not user_id) - the same physical device reopening
  // the app re-sends the same Expo token every time; this keeps it a
  // no-op update instead of piling up duplicate rows for one device. A
  // fresh install/reinstall gets a new token from Expo, which is exactly
  // when a genuinely new row is wanted.
  const { error: upsertError } = await supabase
    .from("hriboradar_push_tokens")
    .upsert({ token, platform, updated_at: new Date().toISOString() }, { onConflict: "token" });

  if (upsertError) {
    console.error("push-token upsert error:", upsertError);
    res.status(500).json({ error: "Nepodařilo se uložit push token." });
    return;
  }

  res.status(200).json({ ok: true });
}
