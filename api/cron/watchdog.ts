import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { fetchWeather } from "../../lib/weather";
import { fetchTerrain } from "../../lib/terrain";
import { scoreSpeciesDay, type Species } from "../../lib/scoring";
import { overallScore } from "../../lib/grid";
import { sendEmail, watchdogEmail } from "../../lib/email";
import { sendPushNotifications } from "../../lib/push";
import speciesData from "../data/species.json";

/**
 * POST /api/cron/watchdog - "Houbařský pes". Checks every saved location
 * that has a watchdog configured (hriboradar_saved_locations.
 * watchdog_threshold_pct not null) against today's real forecast at that
 * exact spot, and notifies the owner once the threshold is crossed - a
 * real push notification to every device that's registered one (see
 * api/push-token.ts), plus an e-mail every time regardless. The e-mail
 * isn't just a fallback for someone with push permission denied - it also
 * covers the window before this user's app has actually been rebuilt with
 * EAS to include the native push module at all (Expo Go and an
 * old dev-client build can't receive push no matter what this endpoint
 * does), so it stays a real, permanent second channel, not just a stopgap.
 *
 * Runs once a day (06:00 UTC, see vercel.json) - Vercel's Hobby plan caps
 * cron jobs at one run per day per job, and probability doesn't swing
 * sharply hour to hour anyway (it's driven by weather/season, not by the
 * minute), so a morning check before someone plans their day covers this
 * well. Upgrade to Pro (or a second, differently-timed cron entry) if this
 * ever needs to be more frequent.
 *
 * Plus-only, same as every other saved-location alert (see
 * useNotificationGenerator.ts's module comment) - checked via a join
 * against hriboradar_subscriptions rather than trusting anything client-
 * supplied, consistent with how the rest of this app treats subscription
 * status as server-verified, not client-asserted.
 *
 * Runs with the service_role key - same reasoning as recalibrate.ts and
 * the RevenueCat webhook: this is the one piece allowed to read/notify
 * across every user's saved locations at once, which RLS blocks for the
 * anon/authenticated roles by design.
 */

interface WatchdogRow {
  id: number;
  user_id: string;
  lat: number;
  lon: number;
  label: string;
  watchdog_species_id: string | null;
  watchdog_threshold_pct: number;
  watchdog_notified_at: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: "Supabase service role not configured" });
    return;
  }
  const admin = createClient(url, serviceKey);

  const { data: rows, error } = await admin
    .from("hriboradar_saved_locations")
    .select("id, user_id, lat, lon, label, watchdog_species_id, watchdog_threshold_pct, watchdog_notified_at")
    .not("watchdog_threshold_pct", "is", null);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const watchdogs = (rows ?? []) as WatchdogRow[];
  if (watchdogs.length === 0) {
    res.status(200).json({ ok: true, checked: 0, notified: 0 });
    return;
  }

  // One query for every user_id with an active watchdog, rather than one
  // per row - a single user can have several watchdog locations.
  const userIds = Array.from(new Set(watchdogs.map((w) => w.user_id)));
  const { data: subRows } = await admin
    .from("hriboradar_subscriptions")
    .select("user_id, status")
    .in("user_id", userIds);
  const activeUserIds = new Set((subRows ?? []).filter((s) => s.status === "active").map((s) => s.user_id));

  const { data: tokenRows } = await admin.from("hriboradar_push_tokens").select("user_id, token").in("user_id", userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokenRows ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  const species = speciesData.species as Species[];
  const todayStr = new Date().toISOString().slice(0, 10);
  let notified = 0;
  let checked = 0;

  for (const row of watchdogs) {
    if (!activeUserIds.has(row.user_id)) continue; // Plus-only, silently skipped rather than erroring
    checked += 1;
    try {
      const [days, terrain] = await Promise.all([fetchWeather(row.lat, row.lon), fetchTerrain(row.lat, row.lon)]);
      const todayIndex = days.findIndex((d) => d.date === todayStr);
      if (todayIndex < 0) continue;

      let score: number;
      let speciesName: string | null = null;
      let topSpeciesName: string | null = null;

      if (row.watchdog_species_id) {
        const sp = species.find((s) => s.id === row.watchdog_species_id);
        if (!sp) continue; // species removed from the catalog since the watchdog was set
        score = scoreSpeciesDay(days, todayIndex, sp, terrain).probability_pct;
        speciesName = sp.name_cz;
      } else {
        const scores: Record<string, number> = {};
        for (const sp of species) scores[sp.id] = scoreSpeciesDay(days, todayIndex, sp, terrain).probability_pct;
        score = overallScore(scores);
        const topId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
        topSpeciesName = species.find((s) => s.id === topId)?.name_cz ?? null;
      }

      const crossed = score >= row.watchdog_threshold_pct;

      if (!crossed) {
        // Streak (if any) ended - clear the flag so a future crossing can notify again.
        if (row.watchdog_notified_at) {
          await admin.from("hriboradar_saved_locations").update({ watchdog_notified_at: null }).eq("id", row.id);
        }
        continue;
      }

      if (row.watchdog_notified_at) continue; // already notified for this ongoing streak

      const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
      const email = userData?.user?.email;

      await admin.from("hriboradar_notifications").upsert(
        {
          user_id: row.user_id,
          dedupe_key: `watchdog:${row.id}:${todayStr}`,
          kind: "location",
          title: `🐕 ${row.label}`,
          body: speciesName
            ? `${speciesName} má teď ${score} % šanci - hlídací pes to zaznamenal.`
            : `Šance na houby je teď ${score} %${topSpeciesName ? ` (${topSpeciesName})` : ""} - hlídací pes to zaznamenal.`,
        },
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
      );

      if (email) {
        await sendEmail({
          to: email,
          ...watchdogEmail({
            locationLabel: row.label,
            speciesName,
            topSpeciesName,
            score,
            thresholdPct: row.watchdog_threshold_pct,
          }),
        });
      }

      const pushTokens = tokensByUser.get(row.user_id) ?? [];
      if (pushTokens.length > 0) {
        const pushTitle = `🐕 ${row.label}`;
        const pushBody = speciesName
          ? `${speciesName} má teď ${score} % šanci - nad vaší hranicí ${row.watchdog_threshold_pct} %.`
          : `Šance na houby je teď ${score} %${topSpeciesName ? ` (nejlépe ${topSpeciesName})` : ""} - nad vaší hranicí ${row.watchdog_threshold_pct} %.`;
        await sendPushNotifications(
          pushTokens.map((to) => ({ to, title: pushTitle, body: pushBody, data: { locationId: row.id } }))
        );
      }

      await admin.from("hriboradar_saved_locations").update({ watchdog_notified_at: todayStr }).eq("id", row.id);
      notified += 1;
    } catch {
      // one location's forecast failing (weather API hiccup, etc.) shouldn't block the rest
      continue;
    }
  }

  res.status(200).json({ ok: true, checked, notified });
}
