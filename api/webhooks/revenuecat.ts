import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, subscriptionActiveEmail, subscriptionCanceledEmail, billingIssueEmail } from "../../lib/email";

/**
 * POST /api/webhooks/revenuecat
 *
 * Server-side mirror of subscription state (hriboradar_subscriptions) and the
 * trigger point for transactional emails - NOT the gating mechanism itself.
 * The app gates Plus features from the RevenueCat SDK's on-device
 * entitlement check directly (see mobile/src/SubscriptionContext.tsx),
 * which is faster and still works if this endpoint is ever down; this just
 * keeps a server-side record and sends the "welcome to Plus" / "sorry to
 * see you go" emails a client-side check alone can't do.
 *
 * Configured as this URL in the RevenueCat dashboard -> Project settings ->
 * Integrations -> Webhooks, with the same secret set below as the
 * Authorization header value.
 */

const STATUS_BY_EVENT: Record<string, string> = {
  INITIAL_PURCHASE: "active",
  RENEWAL: "active",
  UNCANCELLATION: "active",
  PRODUCT_CHANGE: "active",
  CANCELLATION: "canceled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "billing_issue",
};

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  original_app_user_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const event = (req.body as { event?: RevenueCatEvent })?.event;
  if (!event?.type || !event.app_user_id) {
    // RevenueCat sends a TEST event with no real app_user_id when you hit
    // "Send test webhook" in the dashboard - 200 so it doesn't look broken.
    res.status(200).json({ ok: true, ignored: "no app_user_id" });
    return;
  }

  const status = STATUS_BY_EVENT[event.type];
  if (!status) {
    // Event types this app doesn't need to act on (TRANSFER, SUBSCRIPTION_PAUSED,
    // etc.) - acknowledged, not an error.
    res.status(200).json({ ok: true, ignored: event.type });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: "Supabase není nakonfigurované." });
    return;
  }
  const admin = createClient(url, serviceKey);

  // app_user_id is the Supabase user id RNPurchases.logIn() was called
  // with (see SubscriptionContext.tsx) - not always a valid uuid (e.g.
  // RevenueCat's own anonymous ids before login), so a malformed one just
  // fails the upsert below rather than crashing the handler.
  const userId = event.app_user_id;
  const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

  const { error: upsertError } = await admin.from("hriboradar_subscriptions").upsert(
    {
      user_id: userId,
      status,
      product_id: event.product_id ?? null,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    // Most likely userId wasn't a real Supabase user (anonymous RevenueCat
    // id) - not worth 500ing the webhook over, RevenueCat would just retry
    // forever for an event that will never resolve.
    res.status(200).json({ ok: true, note: "upsert skipped", detail: upsertError.message });
    return;
  }

  // Best-effort email - a delivery failure here shouldn't turn into a
  // webhook retry storm, sendEmail() already swallows its own errors.
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const to = userData?.user?.email;
  if (to) {
    if (event.type === "INITIAL_PURCHASE") {
      await sendEmail({ to, ...subscriptionActiveEmail() });
    } else if (event.type === "CANCELLATION") {
      await sendEmail({ to, ...subscriptionCanceledEmail(periodEnd) });
    } else if (event.type === "BILLING_ISSUE") {
      await sendEmail({ to, ...billingIssueEmail() });
    }
  }

  res.status(200).json({ ok: true });
}
