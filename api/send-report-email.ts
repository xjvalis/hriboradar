import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runDailyReport } from "../lib/dailyReport";
import { withSentry } from "../lib/sentry";

/**
 * POST /api/send-report-email
 *
 * Manual/test trigger for the daily "kde dnes rostou houby" report (see
 * lib/dailyReport.ts) - the same pipeline api/cron/watchdog.ts runs
 * automatically every morning, reachable here on demand without touching
 * watchdog's real user-facing alert logic (useful for verifying a change
 * to the report itself without waiting for - or risking a side effect in -
 * the actual watchdog run). Secret-protected since it's an unauthenticated
 * POST that costs real Chromium/Resend usage per call.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.REPORT_EMAIL_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ?debug=1 skips the real Resend send and returns each screenshot as
  // base64 instead, so a screenshot-timing fix can be checked directly
  // (saved and viewed) without spending a real e-mail send on every
  // iteration - see lib/dailyReport.ts's runDailyReport().
  const debug = req.query.debug === "1";
  const result = await runDailyReport({ skipEmail: debug });
  res.status(result.ok ? 200 : 502).json(result);
}

export default withSentry(handler);
