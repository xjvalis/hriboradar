import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { captureError, withSentry } from "../lib/sentry";

interface PushTokenBody {
  token: string;
  platform: "ios" | "android";
  monthlyTipEnabled?: boolean;
}

/**
 * POST /api/push-token - registers this device's Expo push token against
 * the signed-in user, so api/cron/watchdog.ts can find it later. Called
 * from mobile/src/PushNotificationContext.tsx once permission is granted.
 *
 * Same auth pattern as api/feedback.ts for the actual write: the caller's
 * own Supabase access token (not the service role), so Postgres RLS - not
 * this handler - is what stops one user from writing a token row under
 * another user's id.
 *
 * One narrow, explicit exception: an Expo push token is bound to one
 * physical device, not one account, so the same device later registering
 * under a *different* Supabase account is a real, legitimate flow (found
 * 2026-09-19: happens for the same reason a person can end up with more
 * than one Supabase account at all - see SubscriptionContext.tsx's
 * "different login provider" comment). Plain RLS
 * (`using (auth.uid() = user_id)`) can never allow that transfer on its
 * own - the policy checks the EXISTING row's owner before permitting an
 * update, so once a token is registered under account A, account B's
 * every future attempt failed outright with "new row violates row-level
 * security policy", silently dropped client-side
 * (registerForPushNotificationsAsync() only logs a warning) - so this
 * user's watchdog alerts arrived by e-mail but never as a real push.
 * Below, the service role is used ONLY to delete a stale row for this
 * exact token owned by someone else, a narrowly scoped privileged step -
 * the actual write that follows still goes through the normal
 * RLS-protected path, unweakened for every other case.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + OPTIONS preflight handled by withSentry now (see lib/sentry.ts).
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
  if (!url || !anonKey) {
    res.status(500).json({ error: "Supabase není nakonfigurované." });
    return;
  }

  const body = req.body as Partial<PushTokenBody>;
  const { token, platform, monthlyTipEnabled } = body;
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

  // See the module comment: reassigns this exact token away from a
  // *different* prior owner before the real, RLS-protected upsert below
  // even runs - narrowly scoped (one exact token, one row at most), never
  // touches any row that already belongs to this caller. Best-effort: if
  // the service role isn't configured, or this delete itself fails, the
  // upsert below still runs and behaves exactly as it always has (fine
  // for the common case of a device re-registering under its own,
  // unchanged account - only the cross-account handoff needs this).
  if (serviceKey) {
    const admin = createClient(url, serviceKey);
    await admin
      .from("hriboradar_push_tokens")
      .delete()
      .eq("token", token)
      .neq("user_id", userData.user.id);
  }

  // onConflict:"token" (not user_id) - the same physical device reopening
  // the app re-sends the same Expo token every time; this keeps it a
  // no-op update instead of piling up duplicate rows for one device. A
  // fresh install/reinstall gets a new token from Expo, which is exactly
  // when a genuinely new row is wanted.
  const row: Record<string, unknown> = { token, platform, updated_at: new Date().toISOString() };
  // Only touched when the caller actually sends it (the monthly-tip toggle
  // in Settings) - registerForPushNotificationsAsync also fires from
  // LocationAlertsSheet's watchdog toggle, which has no opinion on this
  // preference and shouldn't silently flip it back to the column default.
  if (typeof monthlyTipEnabled === "boolean") row.monthly_tip_enabled = monthlyTipEnabled;

  const { error: upsertError } = await supabase
    .from("hriboradar_push_tokens")
    .upsert(row, { onConflict: "token" });

  if (upsertError) {
    console.error("push-token upsert error:", upsertError);
    captureError(upsertError, { platform });
    res.status(500).json({ error: "Nepodařilo se uložit push token." });
    return;
  }

  res.status(200).json({ ok: true });
}

export default withSentry(handler);
