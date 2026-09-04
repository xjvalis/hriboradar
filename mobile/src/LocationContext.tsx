import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reverseGeocode } from "./api";

export interface AppLocation {
  lat: number;
  lon: number;
  label: string;
}

// Smržovka (Jizerské hory) - real forest, unlike Prague, which is why this
// replaced Prague as the dev default (geocoded via OSM Nominatim). Only
// actually shown if GPS is unavailable/denied - see the auto-locate effect
// below, which tries the user's real position first.
export const DEFAULT_LOCATION: AppLocation = { lat: 50.7385, lon: 15.2463, label: "Smržovka" };

export const PRESET_LOCATIONS: AppLocation[] = [
  DEFAULT_LOCATION,
  { lat: 50.075, lon: 14.44, label: "Praha" },
  { lat: 49.1, lon: 13.6, label: "Šumava" },
  { lat: 49.5, lon: 18.4, label: "Beskydy" },
];

interface LocationContextValue {
  location: AppLocation;
  // Any explicit pick that ISN'T "use my current GPS position" - a search
  // result, a saved place, a preset, or a pin dropped on the map. Persists
  // across restarts and sign-out/sign-in (see FIXED_LOCATION_KEY) until the
  // user explicitly asks for GPS again via useGpsLocation - found
  // 2026-09-04: a first real user kept getting re-defaulted to wherever
  // they physically were (often a built-up area with nothing to forecast)
  // every time they reopened the app, even right after picking their
  // chalupa on the map.
  setLocation: (location: AppLocation) => void;
  // The one explicit escape hatch back to "follow my real position" -
  // clears the persisted fixed location so the auto-locate effect below
  // resumes on the next launch instead of staying pinned to whatever was
  // last picked.
  useGpsLocation: (location: AppLocation) => void;
  // False until the initial GPS attempt settles (or GPS_RESOLVE_TIMEOUT_MS
  // elapses) - App.tsx holds the loading screen on this so most users go
  // straight to their real position instead of seeing Smržovka rendered
  // first and then jumping to their real spot a few seconds later once GPS
  // resolves (found 2026-09-02: "poloha se občas divně skáče" - every
  // screen reading `location` re-renders the instant the async effect
  // below calls setLocation, and that swap could land well after the
  // screen was already on screen and being read). Bounded, not unbounded -
  // a denied/slow GPS still can't hang the app forever.
  resolved: boolean;
}

// Device-level, not account-scoped on purpose - a picked "vlastní bod"
// (chalupa, favorite spot) is meaningful even signed out, and should
// survive a sign-out/sign-in exactly like it survives a restart.
const FIXED_LOCATION_KEY = "hriboradar:fixedLocation";

const LocationContext = createContext<LocationContextValue | null>(null);

// expo-location has native code - same crash risk documented at length in
// LocationPickerSheet.tsx (guarded require() instead of a static import so
// an old native build without it linked doesn't take the whole app down,
// since this provider wraps everything).
let ExpoLocation: typeof import("expo-location") | null;
try {
  ExpoLocation = require("expo-location");
} catch {
  ExpoLocation = null;
}

// How long App.tsx's loading screen waits for a real GPS fix before moving
// on with whatever's available (real position if it won the race, Smržovka
// otherwise). GPS on a warm device is usually well under this; a slow/
// denied fix still resolves in the background afterward and updates
// `location` for real once it does - this only bounds how long the loading
// screen blocks, not the GPS attempt itself.
const GPS_RESOLVE_TIMEOUT_MS = 1500;

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<AppLocation>(DEFAULT_LOCATION);
  const [resolved, setResolved] = useState(false);
  // Once the user has picked anything (including tapping "Smržovka" itself
  // as a deliberate choice, or the persisted fixed location loading below),
  // the auto-locate effect must never silently overwrite it - it only gets
  // to set the very first location.
  const userChose = useRef(false);

  function chooseLocation(loc: AppLocation) {
    userChose.current = true;
    setLocation(loc);
    AsyncStorage.setItem(FIXED_LOCATION_KEY, JSON.stringify(loc)).catch(() => {});
  }

  function chooseGpsLocation(loc: AppLocation) {
    userChose.current = true;
    setLocation(loc);
    AsyncStorage.removeItem(FIXED_LOCATION_KEY).catch(() => {});
  }

  // First checks for a persisted fixed location (a real "vlastní bod" the
  // user picked and saved, or any other explicit pick) - if one exists, it
  // wins outright and GPS is never even attempted, so a user who picked
  // their chalupa on the map doesn't get quietly bumped back to wherever
  // they're standing on next launch. Only without one does this fall back
  // to trying the real current position, then Smržovka - "default to
  // wherever the user actually is" is the more useful starting point for a
  // hyper-local forecast than any fixed place. Silent (no error UI) since
  // this is a background best-effort attempt, not a user-initiated action.
  useEffect(() => {
    let cancelled = false;
    const resolveTimer = setTimeout(() => setResolved(true), GPS_RESOLVE_TIMEOUT_MS);
    (async () => {
      try {
        const storedRaw = await AsyncStorage.getItem(FIXED_LOCATION_KEY).catch(() => null);
        if (storedRaw && !cancelled) {
          const stored = JSON.parse(storedRaw) as AppLocation;
          userChose.current = true;
          setLocation(stored);
          return;
        }
      } catch {
        // malformed storage - fall through to the normal GPS attempt below
      }
      if (!ExpoLocation || cancelled || userChose.current) return;
      try {
        const { status } = await ExpoLocation.getForegroundPermissionsAsync();
        const granted =
          status === "granted" ? true : (await ExpoLocation.requestForegroundPermissionsAsync()).status === "granted";
        if (!granted || cancelled || userChose.current) return;
        const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        if (cancelled || userChose.current) return;
        const geocoded = await reverseGeocode(pos.coords.latitude, pos.coords.longitude).catch(() => null);
        if (cancelled || userChose.current) return;
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: geocoded?.label ?? "Aktuální poloha",
        });
      } catch {
        // GPS unavailable/denied/errored - Smržovka stays the default
      }
    })().finally(() => {
      if (!cancelled) setResolved(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(resolveTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ location, setLocation: chooseLocation, useGpsLocation: chooseGpsLocation, resolved }),
    [location, resolved]
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
