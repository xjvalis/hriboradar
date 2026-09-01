import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MapPin, LocateFixed } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { LocationSearchInput } from "./LocationSearchInput";
import { useLocation, PRESET_LOCATIONS, type AppLocation } from "../LocationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { reverseGeocode } from "../api";

// expo-location has native code - see LocationPickerSheet's original
// comment on why this needs a guarded require() rather than a static
// import (a native module not linked yet would crash on evaluation).
let ExpoLocation: typeof import("expo-location") | null;
try {
  ExpoLocation = require("expo-location");
} catch {
  ExpoLocation = null;
}

// The actual "pick a location" UI - current-location button, search,
// saved places, quick presets - shared between LocationPickerSheet (a
// bottom sheet, used from most screens' location pill) and
// SettingsLocationSection (a full page, no sheet-inside-a-page redundancy
// - Nastavení → Poloha used to show a summary card that opened this same
// picker as a second tap; now the picker itself IS the page).
export function LocationPickerBody({ onChoose }: { onChoose: (loc: AppLocation) => void }) {
  const { location } = useLocation();
  const { locations: saved } = useSavedLocations();
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Reverse-geocoded into a real place name rather than just dropping the
  // pin at the raw GPS fix and calling it "Aktuální poloha" forever - once
  // picked, this is a location like any other (feeds Domů/Předpověď), so it
  // should read like one instead of staying a generic label.
  async function useCurrentLocation() {
    setLocateError(null);
    if (!ExpoLocation) {
      setLocateError("Aktuální poloha bude dostupná po další aktualizaci appky.");
      return;
    }
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocateError("Přístup k poloze je zakázaný - povolte ho telefonu v nastavení.");
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const geocoded = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      onChoose({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        label: geocoded?.label ?? "Aktuální poloha",
      });
    } catch {
      setLocateError("Polohu se nepodařilo zjistit.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <View>
      <Pressable onPress={useCurrentLocation} disabled={locating} style={styles.currentRow}>
        {locating ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <LocateFixed size={18} strokeWidth={1.8} color={palette.primary} />
        )}
        <Text style={styles.currentRowText}>{locating ? "Zjišťuji polohu…" : "Aktuální poloha"}</Text>
      </Pressable>
      {locateError && <Text style={styles.locateError}>{locateError}</Text>}

      <LocationSearchInput onSelect={(r) => onChoose({ lat: r.lat, lon: r.lon, label: r.label })} />

      {saved.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Moje uložená místa</Text>
          <View style={{ gap: space.xs }}>
            {saved.map((loc) => {
              const isActive = loc.lat === location.lat && loc.lon === location.lon;
              return (
                <Pressable key={loc.id} onPress={() => onChoose(loc)} style={[styles.row, isActive && styles.rowActive]}>
                  <MapPin size={16} strokeWidth={1.8} color={isActive ? palette.primary : palette.inkFaint} />
                  <Text style={[styles.rowText, isActive && styles.rowTextActive]}>{loc.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Rychlá volba</Text>
      <View style={styles.presetRow}>
        {PRESET_LOCATIONS.map((preset) => {
          const isActive = preset.lat === location.lat && preset.lon === location.lon;
          return (
            <Pressable
              key={preset.label}
              onPress={() => onChoose(preset)}
              style={[styles.preset, isActive && styles.presetActive]}
            >
              <Text style={[styles.presetText, isActive && styles.presetTextActive]}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.primary + "14",
    marginBottom: space.md,
  },
  currentRowText: { ...type.headingSm, color: palette.primary },
  locateError: { ...type.caption, color: palette.danger, marginTop: -space.sm, marginBottom: space.md },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.lg, marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  rowActive: { borderColor: palette.primary, backgroundColor: palette.bg },
  rowText: { ...type.body, color: palette.inkSoft },
  rowTextActive: { color: palette.primary, fontFamily: "Manrope-SemiBold" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  preset: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: palette.surface,
  },
  presetActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  presetText: { ...type.bodySmall, color: palette.inkSoft },
  presetTextActive: { color: palette.white, fontFamily: "Manrope-SemiBold" },
});
