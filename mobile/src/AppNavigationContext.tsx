import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { ScreenName } from "./components/TopBar";

interface AppNavigationValue {
  active: ScreenName;
  setActive: (screen: ScreenName) => void;
  // "Ukázat na mapě" from a species detail sheet needs to both switch tabs
  // and tell MapScreen which species chip to select - there's no router
  // here to carry that as a route param, so it's handed off as one-shot
  // state instead: MapScreen reads and clears it on mount/focus.
  goToMapWithSpecies: (speciesId: string) => void;
  consumeMapSpeciesRequest: () => string | null;
}

const AppNavigationContext = createContext<AppNavigationValue | null>(null);

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ScreenName>("Domů");
  const pendingSpeciesId = useRef<string | null>(null);

  function goToMapWithSpecies(speciesId: string) {
    pendingSpeciesId.current = speciesId;
    setActive("Mapa");
  }

  function consumeMapSpeciesRequest(): string | null {
    const id = pendingSpeciesId.current;
    pendingSpeciesId.current = null;
    return id;
  }

  return (
    <AppNavigationContext.Provider value={{ active, setActive, goToMapWithSpecies, consumeMapSpeciesRequest }}>
      {children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation(): AppNavigationValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) throw new Error("useAppNavigation must be used within AppNavigationProvider");
  return ctx;
}
