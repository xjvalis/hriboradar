import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { palette, scoreColor, scoreLabel, space, type } from "../theme";

export function IndexCard({ value, explanation }: { value: number; explanation: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const color = scoreColor(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 700, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>Houbový index</Text>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color }]}>{display}</Text>
        <Text style={styles.scoreMax}>/ 100</Text>
      </View>
      <Text style={[styles.status, { color }]}>{scoreLabel(value)}</Text>
      <Text style={styles.explanation}>{explanation}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { ...type.label, color: palette.inkFaint },
  dot: { width: 9, height: 9, borderRadius: 5 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: space.sm },
  score: { ...type.displayXl, fontSize: 46, lineHeight: 46 },
  scoreMax: { ...type.body, color: palette.inkFaint, marginLeft: 4, marginBottom: 4 },
  status: { ...type.headingSm, marginTop: 2 },
  explanation: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.sm, lineHeight: 19 },
});
