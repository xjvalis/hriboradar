// Thin wrapper around Expo's push service (https://exp.host/--/api/v2/push/send)
// - the same "no SDK, plain fetch" choice as lib/email.ts's Resend wrapper,
// for the same reason: one endpoint, not worth a dependency. No API key
// needed for Expo's push endpoint itself (that's Expo's own infra sitting
// in front of APNs/FCM); what actually gates delivery is the app having
// been built with EAS (real native push credentials only exist in an EAS
// build, never in Expo Go or a web build - see the guarded getExpoPushTokenAsync
// call in mobile/src/PushNotificationContext.tsx).
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100; // Expo's documented per-request cap
const FETCH_TIMEOUT_MS = 8000;

export interface PushMessage {
  to: string; // Expo push token, e.g. "ExponentPushToken[...]"
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Fire-and-mostly-forget: logs failures instead of throwing, same
 * "a notification failing to send should never fail the caller's real
 * work" philosophy as sendEmail(). Returns the count Expo actually
 * accepted (not necessarily delivered - that's a receipt-polling step
 * this app doesn't need yet, since watchdog notifications aren't
 * time-critical enough to justify tracking delivery receipts).
 */
export async function sendPushNotifications(messages: PushMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  let accepted = 0;
  for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: "default" }))),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error("[push] Expo push endpoint returned", res.status, await res.text());
        continue;
      }
      const json = (await res.json()) as { data?: { status: string }[] };
      accepted += (json.data ?? []).filter((r) => r.status === "ok").length;
    } catch (err) {
      console.error("[push] send failed:", err);
    }
  }
  return accepted;
}
