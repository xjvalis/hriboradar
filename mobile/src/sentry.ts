import * as Sentry from "@sentry/react-native";

// No-ops entirely without a DSN configured (e.g. local dev) - same
// convention as EXPO_PUBLIC_REVENUECAT_IOS_KEY in SubscriptionContext.tsx.
// __DEV__ builds still initialize if a DSN is set (useful for testing the
// integration itself), but nothing here forces that - a blank
// EXPO_PUBLIC_SENTRY_DSN in mobile/.env is enough to disable it locally.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    // Errors and native crashes only, no performance tracing - a handful
    // of screens for a small app isn't worth Sentry's trace-volume quota,
    // and it's shared with the backend project's own quota.
    tracesSampleRate: 0,
    enableNativeCrashHandling: true,
    debug: false,
  });
}

export const wrapWithSentry = SENTRY_DSN ? Sentry.wrap : <T>(component: T): T => component;
