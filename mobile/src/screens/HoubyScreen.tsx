import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { palette, space } from "../theme";
import { SPECIES_BY_ID } from "../speciesInfo";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { Chip } from "../components/Chip";
import { MushroomCard } from "../components/MushroomCard";
import { SeasonTimeline } from "../components/SeasonTimeline";

const allSpecies = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));

export default function HoubyScreen() {
  const [mode, setMode] = useState<"timeline" | "list">("list");

  return (
    <View style={styles.screen}>
      <PageHeader eyebrow={`všech ${allSpecies.length} druhů`} title="Houby" />

      <View style={styles.toggleRow}>
        <Chip label="Podle měsíce" active={mode === "timeline"} onPress={() => setMode("timeline")} />
        <Chip label="Podle abecedy" active={mode === "list"} onPress={() => setMode("list")} />
      </View>

      {mode === "timeline" ? (
        <SeasonTimeline />
      ) : (
        <ScrollView>
          <PaperBackground style={styles.list}>
            {allSpecies.map((item) => (
              <MushroomCard
                key={item.id}
                id={item.id}
                nameCz={item.name_cz}
                nameLatin={item.name_latin}
                edibility={item.edibility}
              />
            ))}
          </PaperBackground>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toggleRow: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, marginBottom: space.md },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
});
