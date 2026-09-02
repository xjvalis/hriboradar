import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
// Type-only import - erased at compile time, so it can't trigger the same
// native-module-not-linked crash the guarded require() below protects
// against. Just gives applyCustomerInfo below a real shape instead of a
// hand-rolled partial one.
import type { CustomerInfo } from "react-native-purchases";

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
// field, confirmed 2026-08-27 by reading it directly off the dashboard
// (Product catalog -> Entitlements -> hřiboradar): it genuinely does carry
// the diacritic, matching the "Hřiboradar+" display name almost exactly -
// an earlier assumption that RevenueCat identifiers can't have diacritics
// was wrong, and had this as "hriboradar" (no háček), which silently never
// matched any real entitlements.active key from getCustomerInfo(). A
// single boolean gate is enough; there's only one paid tier (see
// docs/subscriptions.md for why usage/time limits were rejected in favor
// of a feature-based free/premium split).
const ENTITLEMENT_ID = "hřiboradar";

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

// RevenueCat's PurchasesError.message is the raw underlying StoreKit/Play
// Billing string ("There was a problem with your App Store transaction"
// and worse) - fine for a support ticket, not something to show a user
// mid-purchase. .code is the stable, RevenueCat-defined enum
// (@revenuecat/purchases-typescript-internal/dist/generated/error-codes)
// and is what this maps instead, so a wording change or localization on
// the native SDK side can't silently break the mapping. Codes not listed
// here (CONFIGURATION_ERROR, UNKNOWN_BACKEND_ERROR, etc.) are genuinely
// rare/internal-setup problems a user can't act on - the fallback message
// covers those.
const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  "1": "Nákup byl zrušen.", // PURCHASE_CANCELLED_ERROR - purchase()'s userCancelled check already short-circuits this to no alert at all; kept here as a safety net for restore() or an edge case that reaches this path anyway
  "2": "Obchod je teď nedostupný. Zkuste to prosím za chvíli.", // STORE_PROBLEM_ERROR
  "3": "Nákupy jsou na tomhle zařízení zakázané (rodičovský zámek nebo omezení).", // PURCHASE_NOT_ALLOWED_ERROR
  "5": "Tahle varianta předplatného momentálně není k dispozici.", // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  "6": "Tohle předplatné už máte aktivní.", // PRODUCT_ALREADY_PURCHASED_ERROR
  "7": "Tenhle nákup je už přiřazený k jinému účtu.", // RECEIPT_ALREADY_IN_USE_ERROR
  "10": "Nepodařilo se spojit s obchodem. Zkontrolujte internetové připojení a zkuste to znovu.", // NETWORK_ERROR
  "13": "Tenhle nákup je už přiřazený k jinému účtu.", // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
  "20": "Platba čeká na schválení (např. rodičovský souhlas) - jakmile projde, předplatné se aktivuje samo.", // PAYMENT_PENDING_ERROR
  "32": "Obchod teď neodpovídá. Zkuste to prosím za chvíli.", // PRODUCT_REQUEST_TIMED_OUT_ERROR
  "35": "Vypadá to, že nejste připojení k internetu.", // OFFLINE_CONNECTION_ERROR
};
const PURCHASE_ERROR_FALLBACK = "Nákup se nepodařilo dokončit. Zkuste to prosím znovu.";

function friendlyPurchaseError(e: unknown): string {
  const err = e as { code?: string | number; message?: string };
  if (err.code != null) {
    const mapped = PURCHASE_ERROR_MESSAGES[String(err.code)];
    if (mapped) return mapped;
  }
  return PURCHASE_ERROR_FALLBACK;
}

function extractEntitlement(info: CustomerInfo): ActiveEntitlementInfo | null {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return null;
  return {
    productIdentifier: entitlement.productIdentifier,
    willRenew: entitlement.willRenew,
    expirationDate: entitlement.expirationDate,
  };
}

export type BillingPeriod = "monthly" | "annual";

interface PackageInfo {
  priceString: string;
}

// Surfaced in the Plus settings section so "Spravovat nebo zrušit
// předplatné" isn't a bare link with zero context above it - which plan,
// what it costs, and whether/when it renews. willRenew:false with a real
// expirationDate means "canceled, but still active until that date" (the
// only way that combination happens - RevenueCat doesn't hand back an
// expired entitlement as active at all).
export interface ActiveEntitlementInfo {
  productIdentifier: string;
  willRenew: boolean;
  expirationDate: string | null;
}

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  available: boolean; // false when RNPurchases isn't linked (old native build) or no key configured for this platform
  /** null while offerings are still loading, or if that period isn't configured in RevenueCat yet */
  monthly: PackageInfo | null;
  annual: PackageInfo | null;
  /** null while not premium, or before the first customerInfo response arrives */
  activeEntitlement: ActiveEntitlementInfo | null;
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
  const [activeEntitlement, setActiveEntitlement] = useState<ActiveEntitlementInfo | null>(null);
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
  //
  // Login and the customer-info fetch used to be two separate effects,
  // both keyed only on `available` - which meant getCustomerInfo() could
  // (and on a fresh install, reliably did) fire before logIn() finished
  // switching RevenueCat off its default anonymous customer ID onto the
  // real one. The anonymous ID has no purchase history, so a genuinely
  // premium user briefly - sometimes not so briefly, if the login-complete
  // update never got picked up - read as free until a full app restart
  // (found 2026-09-02: a fresh TestFlight-style install showed the paywall
  // on a real Plus account, self-corrected on relaunch). Sequencing
  // logIn/logOut BEFORE the fetch below, in the same effect, makes that
  // ordering guaranteed instead of a race.
  useEffect(() => {
    if (!available || !RNPurchases) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Re-running for a *changed* user (account switch) must not leave the
    // previous account's isPremium/loading=false sitting there stale while
    // the new logIn+fetch sequence is in flight - a real edge case, but the
    // same underlying "briefly shows the wrong account's status" failure
    // mode as the fresh-install race this effect merge fixes.
    setLoading(true);

    function applyCustomerInfo(info: CustomerInfo) {
      if (cancelled) return;
      const entitlement = extractEntitlement(info);
      setIsPremium(!!entitlement);
      setActiveEntitlement(entitlement);
      setLoading(false);
    }

    (async () => {
      try {
        if (user) await RNPurchases!.logIn(user.id).catch(() => {});
        else await RNPurchases!.logOut().catch(() => {});
        if (cancelled) return;

        RNPurchases!.getCustomerInfo().then(applyCustomerInfo).catch(() => setLoading(false));
        RNPurchases!.getOfferings()
          .then((o) => {
            if (cancelled) return;
            const pkgs = o.current?.availablePackages ?? [];
            const monthlyPkg = findPackage(pkgs, "monthly");
            const annualPkg = findPackage(pkgs, "annual");
            setMonthly(monthlyPkg ? { priceString: monthlyPkg.product.priceString } : null);
            setAnnual(annualPkg ? { priceString: annualPkg.product.priceString } : null);
          })
          .catch(() => {});
        RNPurchases!.addCustomerInfoUpdateListener(applyCustomerInfo);
      } catch {
        if (!cancelled) {
          setNativeOk(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        RNPurchases?.removeCustomerInfoUpdateListener(applyCustomerInfo);
      } catch {
        // already unavailable - nothing to clean up
      }
    };
  }, [available, user]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium: FORCE_PREMIUM_DEV || isPremium,
      loading: FORCE_PREMIUM_DEV ? false : loading,
      available,
      monthly,
      annual,
      activeEntitlement,
      purchase: async (period: BillingPeriod) => {
        if (!available || !RNPurchases) return { error: "Nákup teď není k dispozici." };
        try {
          const offerings = await RNPurchases.getOfferings();
          const pkgs = offerings.current?.availablePackages ?? [];
          const pkg = findPackage(pkgs, period);
          if (!pkg) return { error: "Tahle varianta předplatného momentálně není k dispozici." };
          const { customerInfo } = await RNPurchases.purchasePackage(pkg);
          const entitlement = extractEntitlement(customerInfo);
          setIsPremium(!!entitlement);
          setActiveEntitlement(entitlement);
          return { error: null };
        } catch (e: unknown) {
          const err = e as { userCancelled?: boolean };
          if (err.userCancelled) return { error: null };
          return { error: friendlyPurchaseError(e) };
        }
      },
      restore: async () => {
        if (!available || !RNPurchases) return { error: "Obnovení teď není k dispozici." };
        try {
          const info = await RNPurchases.restorePurchases();
          const entitlement = extractEntitlement(info);
          setIsPremium(!!entitlement);
          setActiveEntitlement(entitlement);
          if (!entitlement) return { error: "Nenašli jsme žádné dřívější předplatné k obnovení." };
          return { error: null };
        } catch (e: unknown) {
          return { error: friendlyPurchaseError(e) };
        }
      },
    }),
    [isPremium, loading, available, monthly, annual, activeEntitlement]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
