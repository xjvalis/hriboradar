import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// No-ops entirely when SENTRY_DSN isn't set (e.g. local dev without a
// Sentry project configured) - same convention as RESEND_API_KEY in
// lib/email.ts and the RevenueCat keys in mobile/src/SubscriptionContext.tsx:
// a missing key means "this feature is off," never a thrown error.
let initialized = false;
function ensureInit() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      // Errors only - no performance/tracing spans. This is a handful of
      // small serverless functions, not a service worth paying Sentry's
      // trace-volume quota to trace.
      tracesSampleRate: 0,
      environment: process.env.VERCEL_ENV ?? "development",
    });
  }
  initialized = true;
}

export function captureError(err: unknown, extra?: Record<string, unknown>): void {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}

// Wraps a Vercel serverless handler so an exception that escapes the
// handler's own try/catch (or one that never had one) still gets
// reported before falling through to Vercel's own generic 500 - a safety
// net alongside the explicit captureError() calls already inside each
// handler's own error handling, not a replacement for them.
export function withSentry<Req extends VercelRequest, Res extends VercelResponse>(
  handler: (req: Req, res: Res) => unknown | Promise<unknown>
): (req: Req, res: Res) => Promise<void> {
  return async (req: Req, res: Res) => {
    ensureInit();
    try {
      await handler(req, res);
    } catch (err) {
      captureError(err, { url: req.url, method: req.method });
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
  };
}
