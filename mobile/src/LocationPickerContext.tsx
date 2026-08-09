import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface LocationPickerContextValue {
  isOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const LocationPickerContext = createContext<LocationPickerContextValue | null>(null);

// Same shape as SpeciesDetailContext - the sheet itself is rendered once
// at the app shell's top level and toggled via this context, rather than
// living inside whichever screen triggers it. A sheet nested inside a
// screen's own ScrollView doesn't reliably get full-screen absolute
// positioning the way a top-level sibling of <ActiveScreen /> does.
export function LocationPickerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(
    () => ({
      isOpen,
      openPicker: () => setIsOpen(true),
      closePicker: () => setIsOpen(false),
    }),
    [isOpen]
  );
  return <LocationPickerContext.Provider value={value}>{children}</LocationPickerContext.Provider>;
}

export function useLocationPicker(): LocationPickerContextValue {
  const ctx = useContext(LocationPickerContext);
  if (!ctx) throw new Error("useLocationPicker must be used within LocationPickerProvider");
  return ctx;
}
