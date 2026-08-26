import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Which *categories* of notification the generator is allowed to produce -
// separate from watchedSpecies/saved-location alerts (those already have
// their own per-item toggles: species chips in Settings, the bell icon per
// row in Moje). This is the coarser "do I want the monthly tip / terrain
// suggestions at all" switch. Kept device-local (AsyncStorage) rather than
// synced to the account: it's a lightweight app-behavior preference, not
// data that needs to follow the user to a new phone, so it doesn't need a
// Supabase table.
const STORAGE_KEY = "hriboradar:notificationPrefs";

interface NotificationPrefs {
  monthlyTipsEnabled: boolean;
  terrainSuggestionsEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { monthlyTipsEnabled: true, terrainSuggestionsEnabled: true };

interface NotificationPrefsContextValue extends NotificationPrefs {
  loaded: boolean;
  setMonthlyTipsEnabled: (v: boolean) => void;
  setTerrainSuggestionsEnabled: (v: boolean) => void;
}

const NotificationPrefsContext = createContext<NotificationPrefsContextValue | null>(null);

export function NotificationPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function update(next: Partial<NotificationPrefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }

  return (
    <NotificationPrefsContext.Provider
      value={{
        ...prefs,
        loaded,
        setMonthlyTipsEnabled: (v) => update({ monthlyTipsEnabled: v }),
        setTerrainSuggestionsEnabled: (v) => update({ terrainSuggestionsEnabled: v }),
      }}
    >
      {children}
    </NotificationPrefsContext.Provider>
  );
}

export function useNotificationPrefs(): NotificationPrefsContextValue {
  const ctx = useContext(NotificationPrefsContext);
  if (!ctx) throw new Error("useNotificationPrefs must be used within NotificationPrefsProvider");
  return ctx;
}
