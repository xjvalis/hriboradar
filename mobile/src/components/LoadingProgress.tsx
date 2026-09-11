import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, ts, type } from "../theme";

// Some of this app's blocking waits DO have a real number behind them now
// (the /api/forest and /api/grid fetches, tracked via XHR onprogress - see
// leafletHtml.ts and xhrProgress.ts) - pass that in as `percent` and this
// shows it directly, so someone on a genuinely bad connection sees the bar
// actually reflect bytes moving, not a timer pretending to be busy. Font
// loading and a few other waits still have nothing real to hook to
// (fonts are bundled into the native binary, not downloaded at runtime),
// so `percent` stays optional - omitting it falls back to a simulated
// climb that eases off short of 100% and gets unmounted once the real
// work finishes (same "cuts off mid-animation" pattern most apps use for
// a genuinely indeterminate wait).
export function LoadingProgress({ percent }: { percent?: number } = {}) {
  const [simulatedPct, setSimulatedPct] = useState(0);
  const barWidth = useRef(new Animated.Value(0)).current;
  const pct = percent ?? simulatedPct;

  useEffect(() => {
    if (percent != null) return;
    const id = setInterval(() => {
      setSimulatedPct((p) => Math.min(p + (92 - p) * 0.1 + 0.4, 92));
    }, 120);
    return () => clearInterval(id);
  }, [percent]);

  useEffect(() => {
    // useNativeDriver: true - this used to animate `width` directly
    // (useNativeDriver: false, since RN can't native-drive layout
    // properties), which meant every tick handed the JS thread a fresh
    // frame to compute *while that same thread is usually busy with the
    // exact heavy synchronous work this bar exists to show progress for*
    // (parsing /api/forest and /api/grid's multi-MB payloads) - caught as
    // a 2+ second "App Hanging" in Sentry 2026-09-11. scaleX is a
    // transform, so it animates entirely on the UI thread instead and
    // can't contend with JS-thread work at all.
    Animated.timing(barWidth, { toValue: pct / 100, duration: 150, useNativeDriver: true }).start();
  }, [pct, barWidth]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.pct}>{Math.round(pct)} %</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transform: [{ scaleX: barWidth }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: space.sm, width: ts(160) },
  pct: { ...type.displayLg, fontSize: ts(22), lineHeight: ts(26), color: palette.success, fontVariant: ["tabular-nums"] },
  track: {
    width: "100%",
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    marginTop: space.xs,
    overflow: "hidden",
  },
  // width is fixed at 100% of the track now (was the animated property
  // itself) - scaleX above shrinks/grows it from a fixed full-width
  // element instead, which needs the transform to originate from the
  // left edge (RN's default is center) so it still reads as "filling up"
  // left-to-right, not growing from the middle.
  fill: {
    width: "100%",
    height: "100%",
    backgroundColor: palette.success,
    borderRadius: radius.pill,
    transformOrigin: "left",
  },
});
