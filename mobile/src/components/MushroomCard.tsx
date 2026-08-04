import { StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";
import { Card } from "./Card";
import { ProbabilityBadge } from "./ProbabilityBadge";
import { MushroomThumb } from "../photos";

export function MushroomCard({
  id,
  nameCz,
  nameLatin,
  probabilityPct,
  edibility,
}: {
  id: string;
  nameCz: string;
  nameLatin: string;
  probabilityPct?: number;
  edibility?: string;
}) {
  return (
    <Card style={styles.card}>
      <MushroomThumb id={id} name={nameCz} size={56} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={styles.name}>{nameCz}</Text>
        <Text style={styles.latin}>{nameLatin}</Text>
        {edibility ? <Text style={styles.edibility}>{edibility}</Text> : null}
      </View>
      {probabilityPct != null && <ProbabilityBadge pct={probabilityPct} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: space.sm },
  name: { ...type.headingMd, color: palette.ink },
  latin: { ...type.bodySmall, fontStyle: "italic", color: palette.inkFaint, marginTop: 1 },
  edibility: { ...type.caption, color: palette.secondary, marginTop: 3 },
});
