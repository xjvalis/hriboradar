import { Image, View, Text, StyleSheet } from "react-native";
import { palette, fontFamily, radius } from "./theme";

// Metro needs literal require() calls, so this map is spelled out by hand
// rather than built from a string. 10 of 15 species have a real (licensed,
// Wikimedia Commons) photo so far — the rest fall back to a plain
// monogram until more photos are sourced.
const PHOTOS: Record<string, ReturnType<typeof require>> = {
  "hrib-smrkovy": require("../assets/mushrooms/hrib-smrkovy.jpg"),
  "liska-obecna": require("../assets/mushrooms/liska-obecna.jpg"),
  "kozak-brezovy": require("../assets/mushrooms/kozak-brezovy.jpg"),
  "kremenac-brezovy": require("../assets/mushrooms/kremenac-brezovy.jpg"),
  "bedla-vysoka": require("../assets/mushrooms/bedla-vysoka.jpg"),
  "klouzek-slizky": require("../assets/mushrooms/klouzek-slizky.jpg"),
  "klouzek-zrnity": require("../assets/mushrooms/klouzek-zrnity.jpg"),
  "kotrc-kadeřavy": require("../assets/mushrooms/kotrc-kadeřavy.jpg"),
  "kremenac-osikovy": require("../assets/mushrooms/kremenac-osikovy.jpg"),
  "holubinka-nazelenala": require("../assets/mushrooms/holubinka-nazelenala.jpg"),
};

export function MushroomThumb({
  id,
  name,
  size,
}: {
  id: string;
  name: string;
  size: number;
}) {
  const source = PHOTOS[id];
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: radius.sm }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size }]}>
      <Text style={styles.fallbackLetter}>{name.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: radius.sm,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackLetter: {
    fontFamily: fontFamily.displayBold,
    color: palette.surface,
    fontSize: 20,
  },
});
