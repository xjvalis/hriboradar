# Subscriptions

Working note for the RevenueCat-backed paywall (Hřiboradar+). Not user-facing.

## Why RevenueCat

Apple's guideline 3.1.1 requires digital subscriptions sold in-app to go through
StoreKit (no raw Stripe checkout inside the iOS app). Google Play has the
equivalent requirement for Play Billing. RevenueCat unifies StoreKit, Play
Billing, and its own Web Billing (Stripe-backed, used only on the web build,
where there's no app store to satisfy) behind one client API, one entitlement
model, and one webhook, instead of three separate purchase integrations.

## Entitlement and packages

- Entitlement ID: `hřiboradar` (RevenueCat dashboard "Identifier" field -
  verified 2026-08-27 by reading it directly off Product catalog ->
  Entitlements, it does carry the diacritic despite an earlier wrong
  assumption that identifiers can't. A promotional grant issued against
  `hriboradar` (no háček) silently never matched, since
  `getCustomerInfo().entitlements.active` keys on the real identifier -
  that mismatch is what SubscriptionContext.tsx's `ENTITLEMENT_ID` constant
  must match exactly).
- Package identifiers: `monthly` and `yearly` (custom, not the predefined
  RevenueCat package types) - see `findPackage()` in
  `mobile/src/SubscriptionContext.tsx`, which matches on both the predefined
  `packageType` and the custom identifier so it keeps working if the
  dashboard config changes.
- Pricing: 69 Kč/month, 599 Kč/year.

## Why a single boolean gate

`isPremium` is one boolean, not a usage counter or time-limited trial. The
free/premium split is feature-based (which screens/forecasts are visible),
not consumption-based. This was chosen because usage limits need their own
tracking/reset logic and give users a worse "why am I locked out" experience
than a clear feature line; a single entitlement is also all RevenueCat needs
to check, so there is no separate quota system to keep in sync with it.

## Paywall UI

`PaywallModal.tsx` is custom-built, not RevenueCat's prebuilt Paywall UI
(`react-native-purchases-ui`, deliberately not a dependency). This gives full
control over layout/copy in Czech and avoids pulling in a component library
tuned for RevenueCat's own dashboard-configured paywall templates.

## Current state: iOS real, Android still Test Store

Paid Apps Agreement, Bank Account, and both Tax Forms all show **Active** in
App Store Connect as of 2026-08-28 (were "Processing" earlier) - this was the
likely cause of the "[RevenueCat] There was a problem with the App Store"
console warning seen during testing (StoreKit can't return real product/price
data for an app whose paid-agreement chain isn't fully active yet). Worth a
fresh app restart to confirm that warning is gone and `getOfferings()` now
returns real priced packages instead of nulls.

iOS is wired to the real App Store Connect app (`cz.hriboradar.app`) - real
`hriboradar_plus_monthly` / `hriboradar_plus_annual` products exist there,
attached to the `hriboradar` entitlement in RevenueCat, packaged in the
current offering as `monthly` / `yearly`. `mobile/.env` (gitignored) has the
real iOS key (`appl_...`) in `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` still points at the "Test Store" sandbox
key - deliberate, not a bug, until Google Play Console has the matching
products.

Also required for iOS (done): an **In-App Purchase Key** (App Store Server
API - Users and Access → Integrations in App Store Connect, a `.p8` file +
Key ID + Issuer ID) uploaded to RevenueCat. Required for StoreKit 2
(Purchases v5.x+) to record transactions and get accurate pricing/country
data - separate from the App-Specific Shared Secret.

Before Android purchases work:

1. Create the same two subscription products in Google Play Console
   (monthly/yearly, matching prices) - app must be at least in internal
   testing there first.
2. Add a real Google Play app in RevenueCat, attach those products to the
   `hriboradar` entitlement, add them to the current offering as
   `monthly`/`yearly` packages (same identifiers as iOS).
3. Get the real Android API key from RevenueCat and set
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to it.

Before either platform's purchases are live for real users:

4. Verify the `api/webhooks/revenuecat.ts` webhook is registered against the
   production RevenueCat project, not the sandbox one.
5. A real EAS build is required either way - `react-native-purchases` cannot
   function in Expo Go (see below), so nothing here is testable without one.

## Expo Go crash guard

`react-native-purchases` has native code; every `RNPurchases.*` call in
`SubscriptionContext.tsx` is wrapped in try/catch because the native module
isn't linked under Expo Go, and it throws synchronously on any call, not just
on `require()`. When that happens, `nativeOk` flips to false and the paywall
shows "coming in an update" instead of crashing the app shell.
