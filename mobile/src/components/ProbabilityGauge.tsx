import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import { palette, type } from "../theme";

const AnimatedG = Animated.createAnimatedComponent(G);

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// Zone boundaries mirror scoreTier() in theme.ts so the red/amber/green
// band under the needle always agrees with the scoreLabel/scoreColor text
// shown next to the gauge.
const ZONES = [
  { from: 0, to: 28, color: palette.danger },
  { from: 28, to: 55, color: palette.accent },
  { from: 55, to: 100, color: palette.success },
];

const TICK_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// A playful analog barometer instead of a flat progress ring - a needle
// sweeps a fixed red/amber/green zone band, spring-animated so it settles
// like a real instrument needle rather than a counter ticking up.
export function ProbabilityGauge({
  value,
  size = 132,
  strokeWidth = 11,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.spring(anim, { toValue: value, useNativeDriver: false, damping: 14, mass: 0.6 }).start();
    // Non-native-driver Animated ticks via requestAnimationFrame under the
    // hood, which some WebView/preview contexts silently suspend when the
    // surface isn't actively compositing - without this, the needle would
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

  const pad = Math.max(18, strokeWidth + 8);
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = radius + pad;
  const svgHeight = cy + strokeWidth / 2 + 4;
  const needleLen = radius - strokeWidth / 2 - 4;
  const tickInner = radius + strokeWidth / 2 + 3;
  const tickOuter = tickInner + 6;

  // The needle is drawn once pointing left (angle 180deg = value 0), then
  // rotated 0deg -> 180deg as value goes 0 -> 100 via the SVG `transform`
  // attribute string - not the rotation/origin props, which don't
  // translate cleanly to web (they log invalid-DOM-property warnings there).
  const rotateTransform = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [`rotate(0 ${cx} ${cy})`, `rotate(180 ${cx} ${cy})`],
  });

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={svgHeight} viewBox={`0 0 ${size} ${svgHeight}`}>
        {ZONES.map((zone) => {
          const startAngle = 180 - (zone.from / 100) * 180;
          const endAngle = 180 - (zone.to / 100) * 180;
          return (
            <Path
              key={zone.from}
              d={arcPath(cx, cy, radius, startAngle, endAngle)}
              stroke={zone.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="butt"
              opacity={0.85}
            />
          );
        })}
        {TICK_VALUES.map((v) => {
          const angle = 180 - (v / 100) * 180;
          const major = v === 0 || v === 50 || v === 100;
          const inner = polarToXY(cx, cy, tickInner, angle);
          const outer = polarToXY(cx, cy, major ? tickOuter + 1.5 : tickOuter, angle);
          return (
            <Line
              key={v}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={major ? palette.inkFaint : palette.line}
              strokeWidth={major ? 2 : 1.3}
              strokeLinecap="round"
            />
          );
        })}
        <AnimatedG transform={rotateTransform}>
          <Line x1={cx} y1={cy} x2={cx - needleLen} y2={cy} stroke={color} strokeWidth={3} strokeLinecap="round" />
        </AnimatedG>
        <Circle cx={cx} cy={cy} r={5.5} fill={palette.surface} stroke={color} strokeWidth={2.5} />
      </Svg>
      <View style={styles.readout}>
        <Text style={[styles.value, { color }]}>{display}</Text>
        <Text style={styles.max}>/ 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "flex-end", marginTop: -2 },
  value: { ...type.displayLg, fontSize: 26, lineHeight: 28 },
  max: { ...type.caption, color: palette.inkFaint, marginBottom: 3, marginLeft: 2 },
});
