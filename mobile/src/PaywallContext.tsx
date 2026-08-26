import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Same shape as LocationPickerContext/SpeciesDetailContext - the paywall
// sheet itself renders once at the app shell's top level (PaywallModal),
// any screen just calls openPaywall() when a free user taps something
// gated. `reason` carries a short, feature-specific line ("Chcete sledovat
// víc než jedno místo?") so the paywall can explain *why* it appeared
// instead of always showing the same generic pitch.
interface PaywallContextValue {
  isOpen: boolean;
  reason: string | null;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      isOpen,
      reason,
      openPaywall: (r?: string) => {
        setReason(r ?? null);
        setIsOpen(true);
      },
      closePaywall: () => setIsOpen(false),
    }),
    [isOpen, reason]
  );
  return <PaywallContext.Provider value={value}>{children}</PaywallContext.Provider>;
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within PaywallProvider");
  return ctx;
}
