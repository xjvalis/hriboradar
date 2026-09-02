import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { IS_TABLET } from "../theme";

const TEXTURE = require("../../assets/texture.jpg");

// Phone-only content stretched edge-to-edge across an iPad reads as
// "not designed for this screen" just as much as small text does (see
// theme.ts's FONT_SCALE comment - found from the same iPad screenshot,
// 2026-09-02) - lines of text run absurdly wide, cards sprawl. Capping the
// page at a reading-friendly width and centering it (both the texture AND
// the content, since this container holds both) reads instead like a
// physical field guide page laid on a desk - on-theme for this app rather
// than an awkward compromise. Phone is completely unaffected (IS_TABLET is
// false there, this whole block is a no-op).
const TABLET_MAX_WIDTH = 640;

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
  container: IS_TABLET
    ? { width: "100%", maxWidth: TABLET_MAX_WIDTH, alignSelf: "center", flexGrow: 1 }
    : { width: "100%", flexGrow: 1 },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.16,
    pointerEvents: "none",
  },
});
