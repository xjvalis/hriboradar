import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface AppLocation {
  lat: number;
  lon: number;
  label: string;
}

// Smržovka (Jizerské hory) — real forest, unlike Prague, which is why this
// replaced Prague as the dev default (geocoded via OSM Nominatim).
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

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<AppLocation>(DEFAULT_LOCATION);
  const value = useMemo(() => ({ location, setLocation }), [location]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
