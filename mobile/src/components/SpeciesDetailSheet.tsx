import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { MushroomThumb } from "../photos";
import { SPECIES_BY_ID, groupLabel, monthsToLabel } from "../speciesInfo";
import { useSpeciesDetail } from "../SpeciesDetailContext";
import { BottomSheet } from "./BottomSheet";

export function SpeciesDetailSheet() {
  const { selectedSpeciesId, closeSpecies } = useSpeciesDetail();
  const info = selectedSpeciesId ? SPECIES_BY_ID[selectedSpeciesId] : null;

  if (!info) return null;

  return (
    <BottomSheet onClose={closeSpecies} maxHeight="80%">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <MushroomThumb id={info.id} name={info.name_cz} size={64} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.name}>{info.name_cz}</Text>
            <Text style={styles.latin}>{info.name_latin}</Text>
          </View>
          <Text onPress={closeSpecies} style={styles.close}>
            Zavřít
          </Text>
        </View>

        <View style={[styles.edibilityBadge, info.edibility.startsWith("jedlá po") && styles.edibilityWarn]}>
          <Text
            style={[styles.edibilityText, info.edibility.startsWith("jedlá po") && styles.edibilityWarnText]}
          >
            {info.edibility}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Kde roste</Text>
        <Text style={styles.body}>{info.habitat}</Text>
        {info.host_trees.length > 0 && (
          <Text style={styles.bodyFaint}>Vázaná na: {info.host_trees.join(", ")}</Text>
        )}
        <Text style={styles.bodyFaint}>{groupLabel(info.group)}</Text>

        <Text style={styles.sectionLabel}>Kdy roste</Text>
        <Text style={styles.body}>Sezóna: {monthsToLabel(info.season_months)}</Text>
        {info.season_peak_months.length > 0 && (
          <Text style={styles.bodyFaint}>Vrchol: {monthsToLabel(info.season_peak_months)}</Text>
        )}

        <Text style={styles.sectionLabel}>Podmínky</Text>
        <Text style={styles.body}>
          {info.temp_range_c[0]}–{info.temp_range_c[1]} °C · {info.days_after_rain[0]}–{info.days_after_rain[1]}.
          den po dešti
        </Text>
        <Text style={styles.bodyFaint}>Vlhkost: {info.moisture_need} · Půda: {info.soil}</Text>

        <Text style={styles.sectionLabel}>O modelu</Text>
        <Text style={styles.bodyFaint}>
          Procenta v appce popisují, jak moc aktuální počasí, půda a okolní les odpovídají tomu, co má tenhle
          druh rád — je to odhad z odborné literatury a záznamů nálezů, ne potvrzený nález ani garance.
          {"\n"}Spolehlivost modelu: {info.model_confidence}. {info.confidence_note}
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: space.lg,
    paddingTop: 0,
    paddingBottom: space.xl,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  name: { ...type.headingLg, color: palette.ink },
  latin: { ...type.bodySmall, fontStyle: "italic", color: palette.inkFaint, marginTop: 2 },
  close: { ...type.bodySmall, color: palette.inkFaint },
  edibilityBadge: {
    alignSelf: "flex-start",
    marginTop: space.md,
    backgroundColor: palette.success + "22",
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  edibilityWarn: { backgroundColor: palette.accent + "22" },
  edibilityText: { ...type.headingSm, color: palette.success },
  edibilityWarnText: { color: palette.accent },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.lg, marginBottom: space.xs },
  body: { ...type.body, color: palette.ink },
  bodyFaint: { ...type.bodySmall, color: palette.inkSoft, marginTop: 3 },
});
