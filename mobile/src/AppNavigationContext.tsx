import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import type { ScreenName } from "./components/TopBar";
import { useAuth } from "./AuthContext";

const SCREEN_NAMES: ScreenName[] = ["Domů", "Mapa", "Předpověď", "Houby", "Moje", "Nastavení"];

// Lets a web URL land directly on a given screen/species/region - used by
// the hriboradar.app landing page (embeds this web build in an iframe,
// wants it to open straight on Mapa instead of Domů) and, later, by
// whatever generates the daily "kde dnes rostou houby" screenshots (needs
// to land on a specific species+region without simulating clicks first).
// Native builds never have a browser URL to read, so this is a no-op there.
function readUrlParams(): { screen: ScreenName | null; species: string | null; lat: number | null; lon: number | null; zoom: number | null } {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { screen: null, species: null, lat: null, lon: null, zoom: null };
  }
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get("screen");
  const screen = (SCREEN_NAMES as string[]).includes(screenParam ?? "") ? (screenParam as ScreenName) : null;
  const lat = params.get("lat") != null ? Number(params.get("lat")) : null;
  const lon = params.get("lon") != null ? Number(params.get("lon")) : null;
  const zoom = params.get("zoom") != null ? Number(params.get("zoom")) : null;
  return {
    screen,
    species: params.get("species"),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    zoom: Number.isFinite(zoom) ? zoom : null,
  };
}

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

const urlParams = readUrlParams();

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ScreenName>(urlParams.screen ?? "Domů");
  const pendingSpeciesId = useRef<string | null>(urlParams.species);
  const pendingMapFocus = useRef<MapFocusRequest | null>(
    urlParams.lat != null && urlParams.lon != null
      ? { lat: urlParams.lat, lon: urlParams.lon, zoom: urlParams.zoom ?? 10 }
      : null
  );
  const pendingHoubyTimeline = useRef(false);

  // This provider lives above App.tsx's `if (!user)` branch (so it doesn't
  // remount across a sign-out/sign-in), which meant `active` just kept
  // whatever screen was last open before signing out - signing back in
  // landed you back on Nastavení instead of Domů if that's where you'd
  // been (found 2026-09-03). A genuinely new sign-in (a new/different
  // user id, not just this same session resuming) resets to Domů.
  const prevUserId = useRef<string | null>(null);
  const { user } = useAuth();
  useEffect(() => {
    const id = user?.id ?? null;
    if (id && id !== prevUserId.current) setActive("Domů");
    prevUserId.current = id;
  }, [user]);

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
