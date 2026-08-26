import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/account-delete
 *
 * Permanently deletes the caller's own Supabase auth user (and, via
 * `on delete cascade` on every user_id foreign key in hriboradar_schema.sql,
 * every saved location, feedback row, notification, etc. tied to it).
 *
 * Two-step because deleting a user needs the service_role key, which must
 * never be reachable by anything a client could spoof its way into using -
 * so the caller's own access token is verified first (anon client, exactly
 * like api/feedback.ts), and only *that* verified id is ever deleted. There
 * is deliberately no "user id" field in the request body.
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    res.status(500).json({ error: "Supabase není nakonfigurované." });
    return;
  }

  const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) {
    res.status(401).json({ error: "Neplatné přihlášení." });
    return;
  }

  const admin = createClient(url, serviceKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    res.status(500).json({ error: "Smazání účtu se nezdařilo. Zkuste to prosím znovu." });
    return;
  }

  res.status(200).json({ ok: true });
}
