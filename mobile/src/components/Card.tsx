import { StyleSheet, View, type ViewProps } from "react-native";
import { palette, radius } from "../theme";

// Base editorial card: border + surface, not shadow-heavy. This is the one
// card shell every card-shaped component (MushroomCard, LocationCard, the
// index card, etc.) should wrap with, so radius/border/background never
// drift between screens.
export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
  },
});
