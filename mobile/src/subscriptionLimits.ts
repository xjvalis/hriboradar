// The one free/paid line in the app - shared so MojeScreen and
// LocationSheet (map tap -> "Uložit do Mých míst") can't drift apart on
// what "free" actually allows.
export const FREE_SAVED_LOCATIONS_LIMIT = 1;

// Fallback display prices, shown only until RevenueCat's real offering
// loads (or on the web build, which has no purchase path yet at all - see
// SubscriptionContext.web.tsx) - the real price a user actually pays
// always comes from the store (App Store/Google Play), set there to match
// these. Keep in sync with whatever's configured in App Store Connect /
// Google Play Console / RevenueCat if this ever changes.
export const FALLBACK_MONTHLY_PRICE_CZK = 69;
export const FALLBACK_ANNUAL_PRICE_CZK = 599;
export const FALLBACK_MONTHLY_PRICE = `${FALLBACK_MONTHLY_PRICE_CZK} Kč`;
export const FALLBACK_ANNUAL_PRICE = `${FALLBACK_ANNUAL_PRICE_CZK} Kč`;
