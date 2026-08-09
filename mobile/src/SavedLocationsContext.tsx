import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import type { AppLocation } from "./LocationContext";

export interface SavedLocation extends AppLocation {
  id: string;
  // Undefined means "on" - older saved entries predate this field and
  // should default to alerting rather than silently going quiet.
  alertsEnabled?: boolean;
}

// Pre-auth on-device locations (AsyncStorage) - migrated into the signed-in
// account once, then cleared, so they don't keep reappearing under whatever
// account happens to be logged in on this phone next.
const LEGACY_STORAGE_KEY = "rostou:savedLocations";

interface SavedLocationRow {
  id: number;
  lat: number;
  lon: number;
  label: string;
  alerts_enabled: boolean;
}

function rowToLocation(row: SavedLocationRow): SavedLocation {
  return { id: String(row.id), lat: row.lat, lon: row.lon, label: row.label, alertsEnabled: row.alerts_enabled };
}

interface SavedLocationsContextValue {
  locations: SavedLocation[];
  loaded: boolean;
  addLocation: (location: AppLocation) => void;
  removeLocation: (id: string) => void;
  toggleLocationAlerts: (id: string) => void;
}

const SavedLocationsContext = createContext<SavedLocationsContextValue | null>(null);

// Saved locations live in Supabase, scoped per user via RLS (auth.uid() =
// user_id) - not on-device storage, so each account gets its own list
// regardless of which phone or which other account was used on it before.
export function SavedLocationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLocations([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);

    async function load() {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY).catch(() => null);
      if (legacyRaw) {
        try {
          const legacy: SavedLocation[] = JSON.parse(legacyRaw);
          if (legacy.length > 0) {
            await supabase.from("rostou_saved_locations").insert(
              legacy.map((l) => ({ lat: l.lat, lon: l.lon, label: l.label, alerts_enabled: l.alertsEnabled ?? true }))
            );
          }
        } catch {
          // malformed legacy data - drop it rather than block loading real locations
        }
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {});
      }

      const { data } = await supabase
        .from("rostou_saved_locations")
        .select("id, lat, lon, label, alerts_enabled")
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setLocations((data ?? []).map(rowToLocation));
        setLoaded(true);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(
    () => ({
      locations,
      loaded,
      addLocation: (location: AppLocation) => {
        if (!user) return;
        const exists = locations.some(
          (p) => Math.abs(p.lat - location.lat) < 0.001 && Math.abs(p.lon - location.lon) < 0.001
        );
        if (exists) return;
        supabase
          .from("rostou_saved_locations")
          .insert({ lat: location.lat, lon: location.lon, label: location.label, alerts_enabled: true })
          .select("id, lat, lon, label, alerts_enabled")
          .single()
          .then(({ data }) => {
            if (data) setLocations((prev) => [...prev, rowToLocation(data)]);
          });
      },
      removeLocation: (id: string) => {
        setLocations((prev) => prev.filter((p) => p.id !== id));
        supabase.from("rostou_saved_locations").delete().eq("id", id).then(() => {});
      },
      toggleLocationAlerts: (id: string) => {
        const target = locations.find((p) => p.id === id);
        if (!target) return;
        const next = !(target.alertsEnabled ?? true);
        setLocations((prev) => prev.map((p) => (p.id === id ? { ...p, alertsEnabled: next } : p)));
        supabase.from("rostou_saved_locations").update({ alerts_enabled: next }).eq("id", id).then(() => {});
      },
    }),
    [locations, loaded, user]
  );

  return <SavedLocationsContext.Provider value={value}>{children}</SavedLocationsContext.Provider>;
}

export function useSavedLocations(): SavedLocationsContextValue {
  const ctx = useContext(SavedLocationsContext);
  if (!ctx) throw new Error("useSavedLocations must be used within SavedLocationsProvider");
  return ctx;
}
