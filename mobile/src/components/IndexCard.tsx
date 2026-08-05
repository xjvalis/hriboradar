import { StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { ProbabilityGauge } from "./ProbabilityGauge";
import { palette, scoreColor, scoreLabel, space, type } from "../theme";

export function IndexCard({ value, explanation }: { value: number; explanation: string }) {
  const color = scoreColor(value);

  return (
    <Card style={styles.card}>
      <ProbabilityGauge value={value} color={color} />
      <View style={styles.text}>
        <Text style={styles.eyebrow}>Houbový index</Text>
        <Text style={[styles.status, { color }]}>{scoreLabel(value)}</Text>
        <Text style={styles.explanation}>{explanation}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.lg },
  text: { flex: 1 },
  eyebrow: { ...type.label, color: palette.inkFaint },
  status: { ...type.headingMd, marginTop: 4 },
  explanation: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.xs, lineHeight: 19 },
});
