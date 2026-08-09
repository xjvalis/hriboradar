import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Bell, BellOff, MapPin } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { MushroomThumb } from "../photos";
import { SPECIES_BY_ID, groupLabel, monthsToLabel, siteFidelityTip } from "../speciesInfo";
import { useSpeciesDetail } from "../SpeciesDetailContext";
import { useNotifications } from "../NotificationContext";
import { BottomSheet } from "./BottomSheet";

export function SpeciesDetailSheet() {
  const { selectedSpeciesId, closeSpecies } = useSpeciesDetail();
  const { watchedSpecies, toggleWatchedSpecies } = useNotifications();
  const info = selectedSpeciesId ? SPECIES_BY_ID[selectedSpeciesId] : null;

  if (!info) return null;

  const fidelityTip = siteFidelityTip(info);
  const isWatched = watchedSpecies.includes(info.id);

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

        <View style={styles.badgeRow}>
          <View style={[styles.edibilityBadge, info.edibility.startsWith("jedlá po") && styles.edibilityWarn]}>
            <Text
              style={[styles.edibilityText, info.edibility.startsWith("jedlá po") && styles.edibilityWarnText]}
            >
              {info.edibility}
            </Text>
          </View>
          <Pressable
            onPress={() => toggleWatchedSpecies(info.id)}
            style={[styles.watchBtn, isWatched && styles.watchBtnActive]}
            hitSlop={6}
          >
            {isWatched ? (
              <Bell size={14} strokeWidth={2} color={palette.white} />
            ) : (
              <BellOff size={14} strokeWidth={1.8} color={palette.inkSoft} />
            )}
            <Text style={[styles.watchBtnText, isWatched && styles.watchBtnTextActive]}>
              {isWatched ? "Sledováno" : "Upozornit na tento druh"}
            </Text>
          </Pressable>
        </View>

        {info.safety_note && (
          <View style={styles.safetyBox}>
            <AlertTriangle size={17} strokeWidth={1.8} color={palette.danger} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.safetyTitle}>Nebezpečí záměny</Text>
              <Text style={styles.safetyText}>{info.safety_note}</Text>
            </View>
          </View>
        )}

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

        {fidelityTip && (
          <View style={styles.tipBox}>
            <MapPin size={16} strokeWidth={1.8} color={palette.primary} style={{ marginTop: 1 }} />
            <Text style={styles.tipText}>{fidelityTip}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Jak sbírat</Text>
        <Text style={styles.bodyFaint}>
          Řezat i vytrhávat je v pořádku - třicetiletá švýcarská studie (Egli a kol., 2006, La Chanéaz) mezi
          oběma způsoby nenašla žádný rozdíl v budoucích výnosech. Výtrusy vznikají na klobouku, ne v pahýlu
          nožičky. Lesu skutečně škodí spíš sešlapávání mechu a hrabanky kolem - chodit šetrně má větší
          význam než jak přesně houbu odeberete.
        </Text>

        <Text style={styles.sectionLabel}>O modelu</Text>
        <Text style={styles.bodyFaint}>
          Procenta v appce popisují, jak moc aktuální počasí, půda a okolní les odpovídají tomu, co má tenhle
          druh rád - je to odhad z odborné literatury a záznamů nálezů, ne potvrzený nález ani garance.
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
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: space.md },
  edibilityBadge: {
    backgroundColor: palette.success + "22",
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  edibilityWarn: { backgroundColor: palette.accent + "22" },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    backgroundColor: palette.surface,
  },
  watchBtnActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  watchBtnText: { ...type.caption, color: palette.inkSoft },
  watchBtnTextActive: { color: palette.white },
  edibilityText: { ...type.headingSm, color: palette.success },
  edibilityWarnText: { color: palette.accent },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.lg, marginBottom: space.xs },
  body: { ...type.body, color: palette.ink },
  bodyFaint: { ...type.bodySmall, color: palette.inkSoft, marginTop: 3 },
  tipBox: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
    padding: space.sm,
    backgroundColor: palette.primary + "14",
    borderRadius: radius.sm,
  },
  tipText: { ...type.bodySmall, color: palette.primaryDeep, flex: 1, lineHeight: 18 },
  safetyBox: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
    padding: space.sm,
    backgroundColor: palette.danger + "14",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.danger + "33",
  },
  safetyTitle: { ...type.headingSm, color: palette.danger },
  safetyText: { ...type.bodySmall, color: palette.ink, marginTop: 2, lineHeight: 18 },
});
