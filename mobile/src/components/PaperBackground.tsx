import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const TEXTURE = require("../../assets/texture.jpg");

// One texture image stretched to cover its container ("cover", not
// "repeat") - a tiled pattern reads as a repeating swatch with visible
// seams, one photo read as an actual sheet of paper. Meant to be placed
// *inside* each screen's scrollable content (not around the whole app) so
// the paper scrolls together with the cards sitting on it, instead of
// staying fixed behind content sliding past it.
export function PaperBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, style]}>
      <Image source={TEXTURE} resizeMode="cover" style={styles.texture} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow (not just width) so the texture always reaches at least the
  // full viewport height, not just its own content's natural height - a
  // screen whose content doesn't fill the screen (common on Android's
  // wider range of aspect ratios than iPhone) otherwise showed a visible
  // seam where the textured area ended and the plain palette.bg behind it
  // began. Needs the parent ScrollView's contentContainerStyle to also set
  // flexGrow: 1 (see each screen using this component) - flexGrow alone on
  // this View has nothing to grow within otherwise.
  container: { width: "100%", flexGrow: 1 },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.16,
    pointerEvents: "none",
  },
});
