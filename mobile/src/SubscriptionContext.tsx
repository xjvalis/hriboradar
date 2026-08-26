import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";

// react-native-purchases has native code on iOS/Android - same crash risk
// as expo-location had (see LocationPickerSheet.tsx): a static import
// throws synchronously if the native module isn't linked into the running
// binary yet, which would take down the whole app on launch since this
// context is mounted at the app shell's top level. Guarded require() for
// the same reason. Its web build is pure JS (talks to RevenueCat's REST
// API instead of StoreKit), so it never throws there - the guard mainly
// protects native users on an old build.
let RNPurchases: typeof import("react-native-purchases").default | null;
try {
  RNPurchases = require("react-native-purchases").default;
} catch {
  RNPurchases = null;
}

// Public SDK keys (safe to embed in client code - RevenueCat's own docs
// treat these as publishable, same category as a Stripe publishable key).
// One per storefront: Apple StoreKit and Google Play Billing are separate
// purchase systems Apple/Google guidelines require for their own app
// stores, so RevenueCat needs to know which it's fronting; on web there's
// no store to satisfy, so that build talks to RevenueCat's own Web
// Billing (backed by Stripe) instead - see docs/subscriptions.md.
const RC_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const RC_KEY_WEB = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;

// The one entitlement this app sells - configured with this exact
// identifier in the RevenueCat dashboard, attached to the App Store
// Connect / Google Play / Web Billing products there. A single boolean
// gate is enough; there's only one paid tier (see docs/subscriptions.md
// for why usage/time limits were rejected in favor of a feature-based
// free/premium split).
const ENTITLEMENT_ID = "premium";

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  available: boolean; // false when RNPurchases isn't linked (old native build) or no key configured for this platform
  offeringPriceString: string | null;
  purchase: () => Promise<{ error: string | null }>;
  restore: () => Promise<{ error: string | null }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function keyForPlatform(): string | undefined {
  if (Platform.OS === "ios") return RC_KEY_IOS;
  if (Platform.OS === "android") return RC_KEY_ANDROID;
  return RC_KEY_WEB;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceString, setPriceString] = useState<string | null>(null);
  const key = keyForPlatform();
  const available = !!RNPurchases && !!key;

  useEffect(() => {
    if (!available || !RNPurchases) {
      setLoading(false);
      return;
    }
    RNPurchases.configure({ apiKey: key as string });
    // Native crash logs and unhandled StoreKit/Billing chatter shouldn't
    // spam a release build's console - LOG_LEVEL.ERROR still surfaces
    // real problems.
    RNPurchases.setLogLevel(RNPurchases.LOG_LEVEL.ERROR);
  }, [available, key]);

  // RevenueCat identifies "who is this customer" itself (anonymous ID by
  // default), but purchases need to follow the same person across a
  // reinstall or a new device - logIn ties the RevenueCat customer record
  // to this app's own Supabase user id once known, the same identifier
  // the webhook (api/webhooks/revenuecat.ts) uses to update
  // hriboradar_subscriptions.
  useEffect(() => {
    if (!available || !RNPurchases) return;
    if (!user) {
      RNPurchases.logOut().catch(() => {});
      return;
    }
    RNPurchases.logIn(user.id).catch(() => {});
  }, [available, user]);

  useEffect(() => {
    if (!available || !RNPurchases) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    function applyCustomerInfo(info: { entitlements: { active: Record<string, unknown> } }) {
      if (cancelled) return;
      setIsPremium(ENTITLEMENT_ID in info.entitlements.active);
      setLoading(false);
    }

    RNPurchases.getCustomerInfo().then(applyCustomerInfo).catch(() => setLoading(false));
    RNPurchases.getOfferings()
      .then((o) => {
        const pkg = o.current?.availablePackages[0];
        if (pkg && !cancelled) setPriceString(pkg.product.priceString);
      })
      .catch(() => {});

    RNPurchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    return () => {
      cancelled = true;
      RNPurchases?.removeCustomerInfoUpdateListener(applyCustomerInfo);
    };
  }, [available]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium,
      loading,
      available,
      offeringPriceString: priceString,
      purchase: async () => {
        if (!available || !RNPurchases) return { error: "Nákup teď není k dispozici." };
        try {
          const offerings = await RNPurchases.getOfferings();
          const pkg = offerings.current?.availablePackages[0];
          if (!pkg) return { error: "Předplatné momentálně není k dispozici." };
          const { customerInfo } = await RNPurchases.purchasePackage(pkg);
          setIsPremium(ENTITLEMENT_ID in customerInfo.entitlements.active);
          return { error: null };
        } catch (e: unknown) {
          const err = e as { userCancelled?: boolean; message?: string };
          if (err.userCancelled) return { error: null };
          return { error: err.message ?? "Nákup se nepodařilo dokončit." };
        }
      },
      restore: async () => {
        if (!available || !RNPurchases) return { error: "Obnovení teď není k dispozici." };
        try {
          const info = await RNPurchases.restorePurchases();
          setIsPremium(ENTITLEMENT_ID in info.entitlements.active);
          return { error: null };
        } catch (e: unknown) {
          return { error: (e as Error).message ?? "Obnovení se nepodařilo." };
        }
      },
    }),
    [isPremium, loading, available, priceString]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
