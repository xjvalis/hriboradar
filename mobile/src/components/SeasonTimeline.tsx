import { useEffect, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { SPECIES_BY_ID, MONTH_NAMES_FULL_CZ } from "../speciesInfo";
import { PaperBackground } from "./PaperBackground";
import { useSpeciesDetail } from "../SpeciesDetailContext";

const allSpecies = Object.values(SPECIES_BY_ID);
const currentMonth = new Date().getMonth() + 1;

// Scroll-through "what grows when" — the app's one deliberately educational
// screen, built to make someone feel like they're learning the rhythm of
// the mycological year rather than just checking a forecast. One section
// per month, each species clickable into the same detail sheet as
// everywhere else. Opens already scrolled to the current month rather than
// making everyone start from Leden.
export function SeasonTimeline() {
  const scrollRef = useRef<ScrollView>(null);
  const nowNodeRef = useRef<View | null>(null);
  const nowY = useRef<number | null>(null);
  const { openSpecies } = useSpeciesDetail();

  useEffect(() => {
    // Two different mechanisms because RN's onLayout-derived y-offset +
    // ScrollView.scrollTo (the standard native approach) proved unreliable
    // on web in testing — the DOM's own scrollIntoView is what actually
    // worked there. Native keeps the onLayout/scrollTo path since
    // scrollIntoView doesn't exist off-web.
    const timer = setTimeout(() => {
      if (Platform.OS === "web") {
        (nowNodeRef.current as unknown as HTMLElement | null)?.scrollIntoView?.({
          block: "start",
          behavior: "instant" as ScrollBehavior,
        });
      } else if (nowY.current != null) {
        scrollRef.current?.scrollTo({ y: nowY.current - 8, animated: false });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      <PaperBackground style={styles.content}>
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
            ref={isNow ? nowNodeRef : undefined}
            onLayout={(e) => {
              if (isNow) nowY.current = e.nativeEvent.layout.y;
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
                      <Pressable key={sp.id} style={styles.peakChip} onPress={() => openSpecies(sp.id)}>
                        <Text style={styles.peakChipText}>{sp.name_cz}</Text>
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
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
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
  peakRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  peakChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
  peakChipText: { ...type.caption, fontFamily: "Manrope-Bold", color: palette.white },
  alsoWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  alsoChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceSunken,
  },
  alsoChipText: { ...type.caption, color: palette.inkSoft },
});
