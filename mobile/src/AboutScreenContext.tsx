import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AboutScreenContextValue {
  isOpen: boolean;
  openAbout: () => void;
  closeAbout: () => void;
}

const AboutScreenContext = createContext<AboutScreenContextValue | null>(null);

// Same on-demand-overlay shape as AuthScreenContext/LocationPickerContext -
// static content, opened from the drawer ("O aplikaci", found 2026-09-11),
// no reason to make it one of the tab-bar-driven main screens.
export function AboutScreenProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(
    () => ({ isOpen, openAbout: () => setIsOpen(true), closeAbout: () => setIsOpen(false) }),
    [isOpen]
  );
  return <AboutScreenContext.Provider value={value}>{children}</AboutScreenContext.Provider>;
}

export function useAboutScreen(): AboutScreenContextValue {
  const ctx = useContext(AboutScreenContext);
  if (!ctx) throw new Error("useAboutScreen must be used within AboutScreenProvider");
  return ctx;
}
