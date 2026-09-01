import { LocationPickerBody } from "../LocationPickerBody";
import { useLocation, type AppLocation } from "../../LocationContext";

// Used to show a summary card ("Vyšehrad ›") that opened the picker as a
// second tap - the picker itself IS the page now, so choosing a place is
// one tap instead of two.
export function SettingsLocationSection({ onDone }: { onDone: () => void }) {
  const { setLocation } = useLocation();

  function choose(loc: AppLocation) {
    setLocation(loc);
    onDone();
  }

  return <LocationPickerBody onChoose={choose} />;
}
