import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  setLocation: (location: AppLocation) => void;
}

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

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<AppLocation>(DEFAULT_LOCATION);
  // Once the user has picked anything (including tapping "Smržovka" itself
  // as a deliberate choice), the auto-locate effect below must never
  // silently overwrite it - it only gets to set the very first location.
  const userChose = useRef(false);

  function chooseLocation(loc: AppLocation) {
    userChose.current = true;
    setLocation(loc);
  }

  // Tries the real current position before falling back to Smržovka -
  // "default to wherever the user actually is" is the more useful starting
  // point for a hyper-local forecast than any fixed place, and matches
  // what tapping "Aktuální poloha" in the picker already does manually.
  // Silent (no error UI) since this is a background best-effort attempt,
  // not a user-initiated action - a denial or failure just means Smržovka
  // stays the default, exactly like before this existed.
  useEffect(() => {
    if (!ExpoLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await ExpoLocation!.getForegroundPermissionsAsync();
        const granted =
          status === "granted" ? true : (await ExpoLocation!.requestForegroundPermissionsAsync()).status === "granted";
        if (!granted || cancelled || userChose.current) return;
        const pos = await ExpoLocation!.getCurrentPositionAsync({ accuracy: ExpoLocation!.Accuracy.Balanced });
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
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ location, setLocation: chooseLocation }), [location]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
