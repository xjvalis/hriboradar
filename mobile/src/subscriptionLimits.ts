// The one free/paid line in the app - shared so MojeScreen and
// LocationSheet (map tap -> "Uložit do Mých míst") can't drift apart on
// what "free" actually allows.
export const FREE_SAVED_LOCATIONS_LIMIT = 1;

// Mapa's species-filter chips: the first N species (grid.speciesList's own
// order, same as /api/grid returns it - no separate ranking logic to drift
// out of sync) are free; the rest still show a real chip (not hidden) but
// tapping one opens the paywall instead of switching the map mode. Shared
// between MapScreen.tsx and MapScreen.web.tsx so they can't disagree on
// where the free/paid line falls.
export const FREE_MAP_SPECIES_LIMIT = 5;

// Used where a chip's own render-order index isn't already on hand (e.g. a
// "Ukázat na mapě" deep-link jump, which only has the species id) - looks
// the id up in the same list the chips render from, so both call sites
// agree on the exact same species being free.
export function isSpeciesFree(speciesList: { id: string }[] | undefined, speciesId: string): boolean {
  if (!speciesList) return false;
  const idx = speciesList.findIndex((s) => s.id === speciesId);
  return idx !== -1 && idx < FREE_MAP_SPECIES_LIMIT;
}

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
