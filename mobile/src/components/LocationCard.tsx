import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { ProbabilityBadge } from "./ProbabilityBadge";

export function LocationCard({
  name,
  region,
  topSpecies,
  probabilityPct,
  distanceKm,
  onPress,
}: {
  name: string;
  region: string;
  topSpecies: string;
  probabilityPct: number;
  distanceKm?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {region}
          {distanceKm != null ? ` · ${distanceKm} km` : ""}
        </Text>
        <Text style={styles.top}>Nejvíc: {topSpecies}</Text>
      </View>
      <ProbabilityBadge pct={probabilityPct} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
    width: 220,
  },
  name: { ...type.headingSm, color: palette.ink },
  meta: { ...type.caption, color: palette.inkFaint, marginTop: 2 },
  top: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.sm },
});
