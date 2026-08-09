import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { LocationSearchInput } from "./LocationSearchInput";
import { useLocation, PRESET_LOCATIONS, type AppLocation } from "../LocationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { useLocationPicker } from "../LocationPickerContext";

// Makes the "current location" something to play with rather than a fixed
// label — tap it anywhere it's shown and jump straight to any saved place,
// a quick preset, or a fresh search, without leaving the screen you're on.
// Self-contained (reads its own open/close state) and rendered once at the
// app shell's top level, same as SpeciesDetailSheet — a sheet nested
// inside a screen's own ScrollView doesn't reliably get full-screen
// absolute positioning.
export function LocationPickerSheet() {
  const { isOpen, closePicker } = useLocationPicker();
  const { location, setLocation } = useLocation();
  const { locations: saved } = useSavedLocations();

  if (!isOpen) return null;

  function choose(loc: AppLocation) {
    setLocation(loc);
    closePicker();
  }

  return (
    <BottomSheet onClose={closePicker} maxHeight="80%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Vybrat polohu</Text>
        <LocationSearchInput onSelect={(r) => choose({ lat: r.lat, lon: r.lon, label: r.label })} />

        {saved.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Moje uložená místa</Text>
            <View style={{ gap: space.xs }}>
              {saved.map((loc) => {
                const isActive = loc.lat === location.lat && loc.lon === location.lon;
                return (
                  <Pressable
                    key={loc.id}
                    onPress={() => choose(loc)}
                    style={[styles.row, isActive && styles.rowActive]}
                  >
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
                onPress={() => choose(preset)}
                style={[styles.preset, isActive && styles.presetActive]}
              >
                <Text style={[styles.presetText, isActive && styles.presetTextActive]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.md },
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
