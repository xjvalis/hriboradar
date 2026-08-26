import { createContext, useContext, useMemo, type ReactNode } from "react";

// react-native-purchases has no web build at all (it's a pure native-SDK
// wrapper - TurboModuleRegistry calls that don't even parse for Metro's web
// bundle, so a runtime require() guard like SubscriptionContext.tsx uses for
// old-native-build safety doesn't help here: Metro resolves requires
// statically per file, and picks *this* file over the default .tsx one for
// any web build before either file's code ever runs. Real Web Billing would
// need RevenueCat's separate @revenuecat/purchases-js SDK; until that's
// wired in, the web build simply has no purchase path - it's the same
// "not available yet" case the native guard already handles for an
// old app-store build, just always-on here instead of conditional.
interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  available: boolean;
  offeringPriceString: string | null;
  purchase: () => Promise<{ error: string | null }>;
  restore: () => Promise<{ error: string | null }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium: false,
      loading: false,
      available: false,
      offeringPriceString: null,
      purchase: async () => ({ error: "Předplatné na webu zatím není k dispozici - stáhněte si appku." }),
      restore: async () => ({ error: "Obnovení na webu zatím není k dispozici - stáhněte si appku." }),
    }),
    []
  );
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
