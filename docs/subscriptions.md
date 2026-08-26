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

- Entitlement ID: `hriboradar` (RevenueCat dashboard "Identifier" field, not
  the display name "Hřiboradar+" - identifiers can't carry diacritics).
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

## Current state: Test Store / sandbox

RevenueCat is wired to a "Test Store" only. `mobile/.env` (gitignored) has a
single shared key
(`EXPO_PUBLIC_REVENUECAT_IOS_KEY` = `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`)
pointing at that Test Store - not real per-platform keys. This is a
deliberate placeholder, not a bug.

Before real purchases work:

1. Create real subscription products in App Store Connect and Google Play
   Console (monthly/yearly, matching prices).
2. Attach those products to the `hriboradar` entitlement's real
   (non-Test-Store) offering in the RevenueCat dashboard.
3. Get real iOS and Android API keys from RevenueCat and set them as
   separate `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` values.
4. Verify the `api/webhooks/revenuecat.ts` webhook is registered against the
   production RevenueCat project, not the sandbox one.

## Expo Go crash guard

`react-native-purchases` has native code; every `RNPurchases.*` call in
`SubscriptionContext.tsx` is wrapped in try/catch because the native module
isn't linked under Expo Go, and it throws synchronously on any call, not just
on `require()`. When that happens, `nativeOk` flips to false and the paywall
shows "coming in an update" instead of crashing the app shell.
