import { ScrollView, StyleSheet, Text } from "react-native";
import { palette, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { LocationPickerBody } from "./LocationPickerBody";
import { useLocation, type AppLocation } from "../LocationContext";
import { useLocationPicker } from "../LocationPickerContext";

// Makes the "current location" something to play with rather than a fixed
// label - tap it anywhere it's shown and jump straight to any saved place,
// a quick preset, or a fresh search, without leaving the screen you're on.
// Self-contained (reads its own open/close state) and rendered once at the
// app shell's top level, same as SpeciesDetailSheet - a sheet nested
// inside a screen's own ScrollView doesn't reliably get full-screen
// absolute positioning. The actual picker UI lives in LocationPickerBody,
// shared with SettingsLocationSection's full-page version.
export function LocationPickerSheet() {
  const { isOpen, closePicker } = useLocationPicker();
  const { setLocation } = useLocation();

  if (!isOpen) return null;

  function choose(loc: AppLocation) {
    setLocation(loc);
    closePicker();
  }

  return (
    <BottomSheet onClose={closePicker} maxHeight="80%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Vybrat polohu</Text>
        <LocationPickerBody onChoose={choose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.md },
});
