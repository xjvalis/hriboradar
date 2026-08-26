import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { ScreenName } from "./components/TopBar";

export interface MapFocusRequest {
  lat: number;
  lon: number;
  zoom: number;
}

interface AppNavigationValue {
  active: ScreenName;
  setActive: (screen: ScreenName) => void;
  // "Ukázat na mapě" from a species detail sheet needs to both switch tabs
  // and tell MapScreen which species chip to select - there's no router
  // here to carry that as a route param, so it's handed off as one-shot
  // state instead: MapScreen reads and clears it on mount/focus.
  goToMapWithSpecies: (speciesId: string) => void;
  consumeMapSpeciesRequest: () => string | null;
  // Same one-shot pattern, for "Kam dnes?" region cards - the map should
  // open zoomed to that region, not its usual whole-country view. Separate
  // from `location` (LocationContext) on purpose: changing `location` also
  // re-points Domů's forecast at that spot, which region cards do too, but
  // "zoom in here" is a map-only, one-time instruction that shouldn't stick
  // around for the next unrelated visit to Mapa.
  requestMapFocus: (lat: number, lon: number, zoom?: number) => void;
  consumeMapFocusRequest: () => MapFocusRequest | null;
  // Same one-shot pattern for a notification tap that should land on Houby
  // already scrolled to the current month (SeasonTimeline always scrolls to
  // *today's* month, not a specific target - fine here since these
  // notifications are themselves dated to the month they're read in).
  goToHoubyTimeline: () => void;
  consumeHoubyTimelineRequest: () => boolean;
}

const AppNavigationContext = createContext<AppNavigationValue | null>(null);

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ScreenName>("Domů");
  const pendingSpeciesId = useRef<string | null>(null);
  const pendingMapFocus = useRef<MapFocusRequest | null>(null);
  const pendingHoubyTimeline = useRef(false);

  function goToMapWithSpecies(speciesId: string) {
    pendingSpeciesId.current = speciesId;
    setActive("Mapa");
  }

  function consumeMapSpeciesRequest(): string | null {
    const id = pendingSpeciesId.current;
    pendingSpeciesId.current = null;
    return id;
  }

  function requestMapFocus(lat: number, lon: number, zoom = 10) {
    pendingMapFocus.current = { lat, lon, zoom };
  }

  function consumeMapFocusRequest(): MapFocusRequest | null {
    const req = pendingMapFocus.current;
    pendingMapFocus.current = null;
    return req;
  }

  function goToHoubyTimeline() {
    pendingHoubyTimeline.current = true;
    setActive("Houby");
  }

  function consumeHoubyTimelineRequest(): boolean {
    const req = pendingHoubyTimeline.current;
    pendingHoubyTimeline.current = false;
    return req;
  }

  return (
    <AppNavigationContext.Provider
      value={{
        active,
        setActive,
        goToMapWithSpecies,
        consumeMapSpeciesRequest,
        requestMapFocus,
        consumeMapFocusRequest,
        goToHoubyTimeline,
        consumeHoubyTimelineRequest,
      }}
    >
      {children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation(): AppNavigationValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) throw new Error("useAppNavigation must be used within AppNavigationProvider");
  return ctx;
}
