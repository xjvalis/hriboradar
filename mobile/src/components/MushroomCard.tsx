import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette, space, ts, type } from "../theme";
import { Card } from "./Card";
import { ProbabilityBadge } from "./ProbabilityBadge";
import { SeasonSparkline } from "./SeasonSparkline";
import { MushroomThumb } from "../photos";
import { SPECIES_BY_ID } from "../speciesInfo";
import { useSpeciesDetail } from "../SpeciesDetailContext";

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
  const { openSpecies } = useSpeciesDetail();
  const info = SPECIES_BY_ID[id];
  return (
    <Pressable onPress={() => openSpecies(id)}>
      <Card style={styles.card}>
        <MushroomThumb id={id} name={nameCz} size={ts(56)} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.name}>{nameCz}</Text>
          <Text style={styles.latin}>{nameLatin}</Text>
          {edibility ? <Text style={styles.edibility}>{edibility}</Text> : null}
          {info && <SeasonSparkline seasonMonths={info.season_months} peakMonths={info.season_peak_months} />}
        </View>
        {probabilityPct != null && <ProbabilityBadge pct={probabilityPct} style={{ alignSelf: "center" }} />}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: space.sm },
  name: { ...type.headingMd, color: palette.ink },
  latin: { ...type.bodySmall, fontStyle: "italic", color: palette.inkFaint, marginTop: 1 },
  edibility: { ...type.caption, color: palette.secondary, marginTop: 3 },
});
