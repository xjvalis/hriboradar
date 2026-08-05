import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface SpeciesDetailContextValue {
  selectedSpeciesId: string | null;
  openSpecies: (id: string) => void;
  closeSpecies: () => void;
}

const SpeciesDetailContext = createContext<SpeciesDetailContextValue | null>(null);

// App-wide so any screen (map sheet, "co roste dnes" list, atlas) can open
// the same species detail sheet without prop-drilling a callback down.
export function SpeciesDetailProvider({ children }: { children: ReactNode }) {
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      selectedSpeciesId,
      openSpecies: setSelectedSpeciesId,
      closeSpecies: () => setSelectedSpeciesId(null),
    }),
    [selectedSpeciesId]
  );
  return <SpeciesDetailContext.Provider value={value}>{children}</SpeciesDetailContext.Provider>;
}

export function useSpeciesDetail(): SpeciesDetailContextValue {
  const ctx = useContext(SpeciesDetailContext);
  if (!ctx) throw new Error("useSpeciesDetail must be used within SpeciesDetailProvider");
  return ctx;
}
