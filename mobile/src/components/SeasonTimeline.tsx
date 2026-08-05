import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { SPECIES_BY_ID, MONTH_NAMES_FULL_CZ } from "../speciesInfo";
import { MushroomThumb } from "../photos";
import { useSpeciesDetail } from "../SpeciesDetailContext";

const MONTH_ABBR_CZ = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

const allSpecies = Object.values(SPECIES_BY_ID);
const currentMonth = new Date().getMonth() + 1;

// Scroll-through "what grows when" — the app's one deliberately educational
// screen, built to make someone feel like they're learning the rhythm of
// the mycological year rather than just checking a forecast. Jump-strip at
// top + one section per month, each species clickable into the same detail
// sheet as everywhere else.
export function SeasonTimeline() {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const { openSpecies } = useSpeciesDetail();

  function jumpTo(month: number) {
    const y = offsets.current[month];
    if (y != null) scrollRef.current?.scrollTo({ y: y - 8, animated: true });
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.jumpRow}
        contentContainerStyle={{ gap: space.xs }}
      >
        {MONTH_ABBR_CZ.map((abbr, i) => {
          const month = i + 1;
          const isNow = month === currentMonth;
          return (
            <Pressable
              key={month}
              onPress={() => jumpTo(month)}
              style={[styles.jumpChip, isNow && styles.jumpChipNow]}
            >
              <Text style={[styles.jumpChipText, isNow && styles.jumpChipTextNow]}>{abbr}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {MONTH_NAMES_FULL_CZ.map((name, i) => {
          const month = i + 1;
          const peak = allSpecies.filter((sp) => sp.season_peak_months.includes(month));
          const also = allSpecies.filter(
            (sp) => sp.season_months.includes(month) && !sp.season_peak_months.includes(month)
          );
          const isNow = month === currentMonth;

          return (
            <View
              key={month}
              onLayout={(e) => {
                offsets.current[month] = e.nativeEvent.layout.y;
              }}
              style={styles.monthBlock}
            >
              <View style={styles.monthHeaderRow}>
                <Text style={styles.monthName}>{name}</Text>
                {isNow && <Text style={styles.monthNowTag}>teď</Text>}
              </View>

              {peak.length === 0 && also.length === 0 ? (
                <Text style={styles.emptyText}>Mimo sezónu — v tomhle měsíci toho moc neroste.</Text>
              ) : (
                <>
                  {peak.length > 0 && (
                    <View style={styles.peakRow}>
                      {peak.map((sp) => (
                        <Pressable key={sp.id} style={styles.peakCard} onPress={() => openSpecies(sp.id)}>
                          <MushroomThumb id={sp.id} name={sp.name_cz} size={56} />
                          <Text style={styles.peakLabel} numberOfLines={2}>
                            {sp.name_cz}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {also.length > 0 && (
                    <View style={styles.alsoWrap}>
                      {also.map((sp) => (
                        <Pressable key={sp.id} style={styles.alsoChip} onPress={() => openSpecies(sp.id)}>
                          <Text style={styles.alsoChipText}>{sp.name_cz}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  jumpRow: { flexGrow: 0, paddingHorizontal: space.lg, paddingBottom: space.sm },
  jumpChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  jumpChipNow: { backgroundColor: palette.primary, borderColor: palette.primary },
  jumpChipText: { ...type.caption, color: palette.inkSoft },
  jumpChipTextNow: { color: palette.white, fontFamily: "Manrope-SemiBold" },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  monthBlock: { marginTop: space.xl },
  monthHeaderRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  monthName: { ...type.displayLg, fontSize: 22, lineHeight: 26, color: palette.ink },
  monthNowTag: {
    ...type.label,
    color: palette.white,
    backgroundColor: palette.springGreen,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emptyText: { ...type.bodySmall, color: palette.inkFaint, marginTop: space.sm },
  peakRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  peakCard: { width: 80, alignItems: "center", gap: 4 },
  peakLabel: { ...type.caption, color: palette.ink, textAlign: "center" },
  alsoWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  alsoChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceSunken,
  },
  alsoChipText: { ...type.caption, color: palette.inkSoft },
});
