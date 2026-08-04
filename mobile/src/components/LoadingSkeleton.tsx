import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { palette, radius, space } from "../theme";

function Pulse({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Pulse style={{ width: 56, height: 56, borderRadius: radius.sm }} />
      <View style={{ flex: 1, marginLeft: space.md, gap: 6 }}>
        <Pulse style={{ width: "60%", height: 14, borderRadius: 4 }} />
        <Pulse style={{ width: "40%", height: 11, borderRadius: 4 }} />
      </View>
      <Pulse style={{ width: 40, height: 22, borderRadius: radius.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: palette.surfaceSunken },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
  },
});
