import { Pressable, StyleSheet, Text } from "react-native";
import { MapPin } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { useLocation } from "../LocationContext";
import { useLocationPicker } from "../LocationPickerContext";

// One shared "current location, tap to change" affordance - Domů, Mapa,
// and Předpověď each used to show this differently (an underlined text
// row, nothing at all, nothing at all) even though they all open the same
// picker sheet underneath. Same component everywhere means the visual
// can't drift screen to screen again.
export function CurrentLocationPill() {
  const { location } = useLocation();
  const { openPicker } = useLocationPicker();

  return (
    <Pressable onPress={openPicker} hitSlop={6} style={styles.pill}>
      <MapPin size={ts(13)} strokeWidth={2.2} color={palette.primary} />
      <Text style={styles.pillText} numberOfLines={1}>
        {location.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: ts(130),
    paddingHorizontal: space.sm,
    paddingVertical: ts(6),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  pillText: { ...type.caption, color: palette.primary, fontFamily: "Manrope-SemiBold" },
});
