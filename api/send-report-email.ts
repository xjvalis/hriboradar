import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../lib/email";
import { captureError, withSentry } from "../lib/sentry";

const REPORT_TO = "xjvalis@gmail.com";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // generous ceiling for a few PNG screenshots

interface ReportEmailBody {
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[]; // content: base64
}

/**
 * POST /api/send-report-email
 *
 * Narrow, single-purpose endpoint for the daily "kde dnes rostou houby"
 * scheduled agent (a Claude cloud routine, added 2026-09-13) to deliver its
 * report - screenshots of mapa.html at today's best spots plus a written
 * percentage breakdown - without that routine ever holding the real Resend
 * API key. Two things keep this from being an open mail relay: the shared
 * secret below (REPORT_EMAIL_SECRET, known only to this endpoint and the
 * routine's own prompt) and a hardcoded recipient - this can only ever
 * send to the one inbox it's for, never anywhere a caller names.
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

  const body = req.body as Partial<ReportEmailBody>;
  const { subject, html, attachments } = body;
  if (typeof subject !== "string" || typeof html !== "string" || !subject || !html) {
    res.status(400).json({ error: "subject and html are required." });
    return;
  }
  if (attachments != null) {
    if (!Array.isArray(attachments) || attachments.some((a) => typeof a?.filename !== "string" || typeof a?.content !== "string")) {
      res.status(400).json({ error: "attachments must be [{filename, content}] with content as base64." });
      return;
    }
    const totalBytes = attachments.reduce((sum, a) => sum + a.content.length * 0.75, 0);
    if (totalBytes > MAX_ATTACHMENT_BYTES) {
      res.status(400).json({ error: "Attachments too large." });
      return;
    }
  }

  try {
    const result = await sendEmail({ to: REPORT_TO, subject, html, attachments });
    if (!result.ok) {
      captureError(new Error("send-report-email failed"), { resendError: result.error });
      res.status(502).json({ error: result.error ?? "Send failed." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    captureError(err);
    res.status(500).json({ error: "Internal error." });
  }
}

export default withSentry(handler);
