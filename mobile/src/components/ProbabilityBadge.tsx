import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { palette, radius, scoreColor, type } from "../theme";

// A structured badge, not a giant pill - small rounded-rect in the score
// color, used consistently anywhere a probability % appears.
export function ProbabilityBadge({
  pct,
  size = "md",
  style,
}: {
  pct: number;
  size?: "sm" | "md";
  // Overrides the default alignSelf:"flex-start" below - needed wherever
  // this sits next to a multi-line sibling (e.g. MojeScreen's saved-location
  // cards: name + coordinates stacked) and should center against the whole
  // sibling, not pin to its top line.
  style?: StyleProp<ViewStyle>;
}) {
  const color = scoreColor(pct);
  return (
    <View style={[styles.badge, { borderColor: color }, size === "sm" && styles.badgeSm, style]}>
      <Text style={[styles.text, { color }, size === "sm" && styles.textSm]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { ...type.headingSm, fontSize: 13 },
  textSm: { fontSize: 11 },
});
