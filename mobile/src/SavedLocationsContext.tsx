import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import type { AppLocation } from "./LocationContext";

export interface SavedLocation extends AppLocation {
  id: string;
  // Undefined means "on" - older saved entries predate this field and
  // should default to alerting rather than silently going quiet.
  alertsEnabled?: boolean;
  // Houbařský pes - null species means "kterýkoli druh" (server applies
  // the same weighted-top-3 "overall" logic as the map, see
  // overallScore() in lib/grid.ts). null threshold means the watchdog is
  // off - see api/cron/watchdog.ts, which actually evaluates these.
  watchdogSpeciesId: string | null;
  watchdogThresholdPct: number | null;
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
  watchdog_species_id: string | null;
  watchdog_threshold_pct: number | null;
}

function rowToLocation(row: SavedLocationRow): SavedLocation {
  return {
    id: String(row.id),
    lat: row.lat,
    lon: row.lon,
    label: row.label,
    alertsEnabled: row.alerts_enabled,
    watchdogSpeciesId: row.watchdog_species_id,
    watchdogThresholdPct: row.watchdog_threshold_pct,
  };
}

interface SavedLocationsContextValue {
  locations: SavedLocation[];
  loaded: boolean;
  addLocation: (location: AppLocation) => void;
  removeLocation: (id: string) => void;
  toggleLocationAlerts: (id: string) => void;
  renameLocation: (id: string, label: string) => void;
  // Houbařský pes - speciesId null means "kterýkoli druh"; thresholdPct
  // null turns the watchdog off entirely. Clears watchdog_notified_at on
  // every change so editing an active watchdog's threshold doesn't leave
  // it stuck "already notified" against the old value.
  setWatchdog: (id: string, speciesId: string | null, thresholdPct: number | null) => void;
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
            await supabase.from("hriboradar_saved_locations").insert(
              legacy.map((l) => ({ lat: l.lat, lon: l.lon, label: l.label, alerts_enabled: l.alertsEnabled ?? true }))
            );
          }
        } catch {
          // malformed legacy data - drop it rather than block loading real locations
        }
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {});
      }

      const { data } = await supabase
        .from("hriboradar_saved_locations")
        .select("id, lat, lon, label, alerts_enabled, watchdog_species_id, watchdog_threshold_pct")
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
          .from("hriboradar_saved_locations")
          .insert({ lat: location.lat, lon: location.lon, label: location.label, alerts_enabled: true })
          .select("id, lat, lon, label, alerts_enabled, watchdog_species_id, watchdog_threshold_pct")
          .single()
          .then(({ data, error }) => {
            if (data) setLocations((prev) => [...prev, rowToLocation(data)]);
            else if (error) Alert.alert("Nepodařilo se uložit místo", "Zkuste to prosím znovu.");
          });
      },
      // Every mutation below is optimistic (instant UI feedback), but each
      // used to fire-and-forget its Supabase call with `.then(() => {})` -
      // any transient network failure meant the local state silently
      // diverged from the database with zero indication anything went
      // wrong, until the next app restart re-fetched the real (unchanged)
      // rows and the edit/delete/rename just reverted with no explanation
      // ("I deleted this place and it came back"). Every call below now
      // reverts its own optimistic update and tells the user, on error.
      removeLocation: (id: string) => {
        const removed = locations.find((p) => p.id === id);
        setLocations((prev) => prev.filter((p) => p.id !== id));
        supabase
          .from("hriboradar_saved_locations")
          .delete()
          .eq("id", id)
          .then(({ error }) => {
            if (error && removed) {
              setLocations((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, removed]));
              Alert.alert("Nepodařilo se smazat místo", "Zkuste to prosím znovu.");
            }
          });
      },
      toggleLocationAlerts: (id: string) => {
        const target = locations.find((p) => p.id === id);
        if (!target) return;
        const next = !(target.alertsEnabled ?? true);
        setLocations((prev) => prev.map((p) => (p.id === id ? { ...p, alertsEnabled: next } : p)));
        supabase
          .from("hriboradar_saved_locations")
          .update({ alerts_enabled: next })
          .eq("id", id)
          .then(({ error }) => {
            if (error) {
              setLocations((prev) => prev.map((p) => (p.id === id ? { ...p, alertsEnabled: !next } : p)));
              Alert.alert("Nepodařilo se uložit změnu", "Zkuste to prosím znovu.");
            }
          });
      },
      renameLocation: (id: string, label: string) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const previousLabel = locations.find((p) => p.id === id)?.label;
        setLocations((prev) => prev.map((p) => (p.id === id ? { ...p, label: trimmed } : p)));
        supabase
          .from("hriboradar_saved_locations")
          .update({ label: trimmed })
          .eq("id", id)
          .then(({ error }) => {
            if (error && previousLabel != null) {
              setLocations((prev) => prev.map((p) => (p.id === id ? { ...p, label: previousLabel } : p)));
              Alert.alert("Nepodařilo se přejmenovat místo", "Zkuste to prosím znovu.");
            }
          });
      },
      setWatchdog: (id: string, speciesId: string | null, thresholdPct: number | null) => {
        const previous = locations.find((p) => p.id === id);
        setLocations((prev) =>
          prev.map((p) => (p.id === id ? { ...p, watchdogSpeciesId: speciesId, watchdogThresholdPct: thresholdPct } : p))
        );
        supabase
          .from("hriboradar_saved_locations")
          .update({ watchdog_species_id: speciesId, watchdog_threshold_pct: thresholdPct, watchdog_notified_at: null })
          .eq("id", id)
          .then(({ error }) => {
            if (error && previous) {
              setLocations((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? { ...p, watchdogSpeciesId: previous.watchdogSpeciesId, watchdogThresholdPct: previous.watchdogThresholdPct }
                    : p
                )
              );
              Alert.alert("Nepodařilo se uložit nastavení", "Zkuste to prosím znovu.");
            }
          });
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
