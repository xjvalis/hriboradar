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

// The one entitlement this app sells - RevenueCat dashboard Identifier
// field (not the "Hřiboradar+" display name, which can have diacritics/
// symbols the actual API identifier can't). A single boolean gate is
// enough; there's only one paid tier (see docs/subscriptions.md for why
// usage/time limits were rejected in favor of a feature-based free/
// premium split).
const ENTITLEMENT_ID = "hriboradar";

// Dev-only escape hatch for previewing/screenshotting Plus screens without
// a real purchase - needed because RevenueCat can't function in Expo Go at
// all (see the nativeOk guard below), so there's no real way to grant
// yourself the entitlement while testing there. __DEV__ is false in every
// "production"/"preview" EAS build, so this can never leak into a real
// user's app - but it IS true in an EAS "development"-profile build (a
// real dev-client install, not just Expo Go), so mobile/.env's
// EXPO_PUBLIC_FORCE_PREMIUM must be "false" except during a deliberate
// screenshot session, or every fresh account on that build looks Plus.
const FORCE_PREMIUM_DEV = __DEV__ && process.env.EXPO_PUBLIC_FORCE_PREMIUM === "true";

// The RevenueCat offering's packages were set up with custom identifiers
// "monthly"/"yearly" rather than picking the predefined monthly/annual
// package types - so packageType alone (PACKAGE_TYPE.MONTHLY/ANNUAL)
// isn't a reliable match if the dashboard config ever changes back and
// forth. Checking both the predefined type AND the custom identifier
// means this keeps working either way, without needing to know which one
// is currently configured.
function findPackage(
  pkgs: import("react-native-purchases").PurchasesPackage[],
  period: BillingPeriod
): import("react-native-purchases").PurchasesPackage | undefined {
  const wantType = period === "monthly" ? RNPurchases!.PACKAGE_TYPE.MONTHLY : RNPurchases!.PACKAGE_TYPE.ANNUAL;
  const wantId = period === "monthly" ? "monthly" : "yearly";
  return pkgs.find((p) => p.packageType === wantType || p.identifier.toLowerCase() === wantId);
}

export type BillingPeriod = "monthly" | "annual";

interface PackageInfo {
  priceString: string;
}

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  available: boolean; // false when RNPurchases isn't linked (old native build) or no key configured for this platform
  /** null while offerings are still loading, or if that period isn't configured in RevenueCat yet */
  monthly: PackageInfo | null;
  annual: PackageInfo | null;
  purchase: (period: BillingPeriod) => Promise<{ error: string | null }>;
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
  const [monthly, setMonthly] = useState<PackageInfo | null>(null);
  const [annual, setAnnual] = useState<PackageInfo | null>(null);
  // Starts true (optimistic) and flips to false the moment any real native
  // call throws - which is exactly what happens under Expo Go: the JS
  // module require()s fine (guarded above), but every actual bridge call
  // throws synchronously because Expo Go ships a fixed set of native
  // modules and can't include a third-party one like this without a real
  // EAS/dev-client build. That's a different failure point than the
  // require() guard above, so every native call below gets its own
  // try/catch instead of relying on `available` alone - three effects can
  // all still fire in the same initial render pass before the first one's
  // setNativeOk(false) takes effect, so each has to protect itself too.
  const [nativeOk, setNativeOk] = useState(true);
  const key = keyForPlatform();
  const hasKey = !!RNPurchases && !!key;
  const available = hasKey && nativeOk;

  useEffect(() => {
    if (!hasKey || !RNPurchases) {
      setLoading(false);
      return;
    }
    try {
      RNPurchases.configure({ apiKey: key as string });
      // Native crash logs and unhandled StoreKit/Billing chatter shouldn't
      // spam a release build's console - LOG_LEVEL.ERROR still surfaces
      // real problems.
      RNPurchases.setLogLevel(RNPurchases.LOG_LEVEL.ERROR);
    } catch (e) {
      console.warn("[Subscription] RevenueCat native module unavailable (Expo Go?) - Plus purchases disabled this session.", e);
      setNativeOk(false);
      setLoading(false);
    }
  }, [hasKey, key]);

  // RevenueCat identifies "who is this customer" itself (anonymous ID by
  // default), but purchases need to follow the same person across a
  // reinstall or a new device - logIn ties the RevenueCat customer record
  // to this app's own Supabase user id once known, the same identifier
  // the webhook (api/webhooks/revenuecat.ts) uses to update
  // hriboradar_subscriptions.
  useEffect(() => {
    if (!available || !RNPurchases) return;
    try {
      if (!user) {
        RNPurchases.logOut().catch(() => {});
        return;
      }
      RNPurchases.logIn(user.id).catch(() => {});
    } catch {
      setNativeOk(false);
    }
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

    try {
      RNPurchases.getCustomerInfo().then(applyCustomerInfo).catch(() => setLoading(false));
      RNPurchases.getOfferings()
        .then((o) => {
          if (cancelled) return;
          const pkgs = o.current?.availablePackages ?? [];
          const monthlyPkg = findPackage(pkgs, "monthly");
          const annualPkg = findPackage(pkgs, "annual");
          setMonthly(monthlyPkg ? { priceString: monthlyPkg.product.priceString } : null);
          setAnnual(annualPkg ? { priceString: annualPkg.product.priceString } : null);
        })
        .catch(() => {});
      RNPurchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    } catch {
      setNativeOk(false);
      setLoading(false);
    }

    return () => {
      cancelled = true;
      try {
        RNPurchases?.removeCustomerInfoUpdateListener(applyCustomerInfo);
      } catch {
        // already unavailable - nothing to clean up
      }
    };
  }, [available]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium: FORCE_PREMIUM_DEV || isPremium,
      loading: FORCE_PREMIUM_DEV ? false : loading,
      available,
      monthly,
      annual,
      purchase: async (period: BillingPeriod) => {
        if (!available || !RNPurchases) return { error: "Nákup teď není k dispozici." };
        try {
          const offerings = await RNPurchases.getOfferings();
          const pkgs = offerings.current?.availablePackages ?? [];
          const pkg = findPackage(pkgs, period);
          if (!pkg) return { error: "Tahle varianta předplatného momentálně není k dispozici." };
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
    [isPremium, loading, available, monthly, annual]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
