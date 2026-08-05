import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { palette, type } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The "visual metaphor" for the index — a radial ring instead of a bare
// number, animated with a gentle spring rather than a linear tween so it
// settles like something growing into place, not a counter ticking up.
export function ProbabilityGauge({
  value,
  size = 108,
  strokeWidth = 10,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.spring(anim, { toValue: value, useNativeDriver: false, damping: 14, mass: 0.6 }).start();
    // Non-native-driver Animated ticks via requestAnimationFrame under the
    // hood, which some WebView/preview contexts silently suspend when the
    // surface isn't actively compositing — without this, the gauge would
    // stay stuck at 0 forever instead of just skipping the animation.
    const fallback = setTimeout(() => {
      anim.setValue(value);
      setDisplay(value);
    }, 1200);
    return () => {
      anim.removeListener(id);
      clearTimeout(fallback);
    };
  }, [value]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* Rotate the whole SVG -90deg via a plain RN transform instead of
          per-circle rotation/origin props — those didn't translate
          cleanly to web (logged invalid-DOM-property warnings there). */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { color }]}>{display}</Text>
        <Text style={styles.max}>/ 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { ...type.displayLg, fontSize: 28, lineHeight: 30 },
  max: { ...type.caption, color: palette.inkFaint, marginTop: -2 },
});
