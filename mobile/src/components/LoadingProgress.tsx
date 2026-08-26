import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";

// None of this app's real blocking waits (font loading, computing the
// nationwide grid, a WebView's page load) expose actual byte-level
// progress - there's nothing to hook a real percentage to. This simulates
// a believable climb instead: fast at first, easing off well short of
// 100%, and simply gets unmounted by the parent once the real work
// finishes (same "cuts off mid-animation" pattern most apps use for
// exactly this kind of indeterminate wait).
export function LoadingProgress() {
  const [pct, setPct] = useState(0);
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => Math.min(p + (92 - p) * 0.1 + 0.4, 92));
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.timing(barWidth, { toValue: pct, duration: 150, useNativeDriver: false }).start();
  }, [pct, barWidth]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.pct}>{Math.round(pct)} %</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: barWidth.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: space.sm, width: 160 },
  pct: { ...type.displayLg, fontSize: 22, lineHeight: 26, color: palette.success, fontVariant: ["tabular-nums"] },
  track: {
    width: "100%",
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    marginTop: space.xs,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: palette.success, borderRadius: radius.pill },
});
