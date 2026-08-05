import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";

const TEXTURE = require("../../assets/texture.jpg");

// One shared texture layer behind the whole app rather than repeated per
// screen/card — a single subtle "paper" base is what actually reads as an
// atlas/field-guide, whereas scattering it around risks looking like a
// pattern rather than a material. Low opacity + tiled (not stretched) so
// the grain stays at a believable physical scale instead of one giant
// smeared photo behind a tall phone screen.
export function PaperBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <Image source={TEXTURE} resizeMode="repeat" style={styles.texture} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  texture: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.16,
    pointerEvents: "none",
  },
});
