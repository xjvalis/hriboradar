import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppLocation } from "./LocationContext";

export interface SavedLocation extends AppLocation {
  id: string;
  // Undefined means "on" — older saved entries predate this field and
  // should default to alerting rather than silently going quiet.
  alertsEnabled?: boolean;
}

const STORAGE_KEY = "rostou:savedLocations";

interface SavedLocationsContextValue {
  locations: SavedLocation[];
  loaded: boolean;
  addLocation: (location: AppLocation) => void;
  removeLocation: (id: string) => void;
  toggleLocationAlerts: (id: string) => void;
}

const SavedLocationsContext = createContext<SavedLocationsContextValue | null>(null);

export function SavedLocationsProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setLocations(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return; // don't clobber storage with the empty initial state before load finishes
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations)).catch(() => {});
  }, [locations, loaded]);

  const value = useMemo(
    () => ({
      locations,
      loaded,
      addLocation: (location: AppLocation) => {
        setLocations((prev) => {
          const exists = prev.some(
            (p) => Math.abs(p.lat - location.lat) < 0.001 && Math.abs(p.lon - location.lon) < 0.001
          );
          if (exists) return prev;
          return [...prev, { ...location, id: `${Date.now()}`, alertsEnabled: true }];
        });
      },
      removeLocation: (id: string) => {
        setLocations((prev) => prev.filter((p) => p.id !== id));
      },
      toggleLocationAlerts: (id: string) => {
        setLocations((prev) =>
          prev.map((p) => (p.id === id ? { ...p, alertsEnabled: !(p.alertsEnabled ?? true) } : p))
        );
      },
    }),
    [locations, loaded]
  );

  return <SavedLocationsContext.Provider value={value}>{children}</SavedLocationsContext.Provider>;
}

export function useSavedLocations(): SavedLocationsContextValue {
  const ctx = useContext(SavedLocationsContext);
  if (!ctx) throw new Error("useSavedLocations must be used within SavedLocationsProvider");
  return ctx;
}
