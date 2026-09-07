import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AuthScreenContextValue {
  isOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const AuthScreenContext = createContext<AuthScreenContextValue | null>(null);

// The app no longer forces login before anything renders (Apple guideline
// 5.1.1(v): non-account features must stay reachable without registering,
// found in App Review feedback 2026-09-07) - LoginScreen is now something
// opened on demand instead of the unavoidable root screen, from wherever a
// genuinely account-based feature needs it (Moje's saved locations,
// Nastavení's account section). Same on-demand-overlay shape as
// LocationPickerContext.
export function AuthScreenProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(
    () => ({ isOpen, openLogin: () => setIsOpen(true), closeLogin: () => setIsOpen(false) }),
    [isOpen]
  );
  return <AuthScreenContext.Provider value={value}>{children}</AuthScreenContext.Provider>;
}

export function useAuthScreen(): AuthScreenContextValue {
  const ctx = useContext(AuthScreenContext);
  if (!ctx) throw new Error("useAuthScreen must be used within AuthScreenProvider");
  return ctx;
}
