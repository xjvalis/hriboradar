import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotifications } from "./push";
import { type Species } from "./scoring";
import speciesData from "../api/data/species.json";

// A real, well-known Czech pranostika per month, mirrored from
// mobile/src/useNotificationGenerator.ts (which used to generate this
// in-app, client-side, on every app open - moved server-side 2026-09-03
// so it can be a real push that reaches someone even when the app isn't
// running, not just a bell-icon entry they only see if they happen to
// open the app that day). Sourced from czechtheworld.com/pranostiky and
// cross-checked against treking.cz/sluzby/pranostiky-pocasi.htm
// (2026-08-26) for the most widely recognized saying per month -
// "Březen, za kamna vlezem" and "Duben, ještě tam budem" are the one
// exception kept as a pair even though the April half wasn't on either
// source list, since they're near-universally quoted together.
const MONTH_HEADLINE: Record<number, string> = {
  1: "Leden studený, duben zelený.",
  2: "Únor bílý, pole sílí.",
  3: "Březen, za kamna vlezem.",
  4: "Duben, ještě tam budem!",
  5: "Mokrý máj, v stodole ráj.",
  6: "Medardova kápě, čtyřicet dní kape.",
  7: "Jaký červenec, takový leden.",
  8: "Srpen k zimě hledí a rád vodu cedí.",
  9: "Září víno vaří a co nedovaří, říjen dopeče.",
  10: "Mrazy v říjnu, hezky v lednu.",
  11: "Jaký listopad, takový březen.",
  12: "Zelené Vánoce, bílé Velikonoce - a naopak.",
};

function topSpeciesNamesForMonth(month: number, count: number): string[] {
  const all = speciesData.species as Species[];
  const peak = all.filter((sp) => sp.season_peak_months.includes(month));
  const pool = peak.length >= count ? peak : all.filter((sp) => sp.season_months.includes(month));
  return pool
    .slice()
    .sort((a, b) => b.gbif_occurrence_count_cz - a.gbif_occurrence_count_cz)
    .slice(0, count)
    .map((sp) => sp.name_cz);
}

interface PushTokenRow {
  user_id: string;
  token: string;
}

/**
 * Broadcasts the monthly pranostika + in-season species digest as a real
 * push, to every device whose owner opted in (hriboradar_push_tokens.
 * monthly_tip_enabled, set via the "Měsíční tip" switch in Nastavení -
 * see api/push-token.ts). Free for everyone regardless of subscription
 * status - explicit user request, the one deliberate exception to every
 * other notification type being Plus-only.
 *
 * Also writes one hriboradar_notifications row per user (not per device)
 * so it shows up in the in-app bell/history the same way it always did -
 * `unique(user_id, dedupe_key)` makes this naturally idempotent if the
 * caller (api/cron/recalibrate.ts) ever runs twice on the 1st.
 */
export async function sendMonthlyTip(supabase: SupabaseClient): Promise<{ sent: number; users: number }> {
  const month = new Date().getUTCMonth() + 1;
  const monthKey = new Date().toISOString().slice(0, 7);
  const headline = MONTH_HEADLINE[month];
  if (!headline) return { sent: 0, users: 0 };

  const names = topSpeciesNamesForMonth(month, 3);
  const body =
    names.length > 0
      ? `Teď mají sezónu: ${names.join(", ")}. Mrkněte na atlas hub.`
      : "Zrovna klidný měsíc pro houby - mrkněte na atlas, kdy se to zase rozjede.";

  const { data: tokenRows, error } = await supabase
    .from("hriboradar_push_tokens")
    .select("user_id, token")
    .eq("monthly_tip_enabled", true);
  if (error || !tokenRows || tokenRows.length === 0) return { sent: 0, users: 0 };

  const rows = tokenRows as PushTokenRow[];
  const tokensByUser = new Map<string, string[]>();
  for (const r of rows) {
    const list = tokensByUser.get(r.user_id) ?? [];
    list.push(r.token);
    tokensByUser.set(r.user_id, list);
  }

  await supabase.from("hriboradar_notifications").upsert(
    Array.from(tokensByUser.keys()).map((user_id) => ({
      user_id,
      dedupe_key: `generic:${monthKey}`,
      kind: "generic",
      title: headline,
      body,
    })),
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
  );

  const sent = await sendPushNotifications(
    rows.map((r) => ({ to: r.token, title: headline, body, data: { kind: "monthly-tip" } }))
  );

  return { sent, users: tokensByUser.size };
}
