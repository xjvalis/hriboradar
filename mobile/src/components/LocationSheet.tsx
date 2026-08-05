import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, scoreColor, scoreLabel, space, type } from "../theme";
import { PrimaryButton } from "./PrimaryButton";
import { ProbabilityBadge } from "./ProbabilityBadge";
import { BottomSheet } from "./BottomSheet";
import { getForecast, type ForecastResponse } from "../api";
import { useSpeciesDetail } from "../SpeciesDetailContext";

export interface SelectedLocation {
  lat: number;
  lon: number;
  probabilityPct: number | null;
  topSpeciesName: string | null;
  topSpeciesId: string | null;
}

export function LocationSheet({
  selected,
  onClose,
}: {
  selected: SelectedLocation;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ForecastResponse | null>(null);
  const { openSpecies } = useSpeciesDetail();

  useEffect(() => {
    setDetail(null);
    // The point tapped comes straight from /api/grid, which already
    // computed & cached weather+terrain for this exact coordinate — this
    // fetch almost always resolves from cache, not a fresh lookup.
    getForecast(selected.lat, selected.lon)
      .then(setDetail)
      .catch(() => {});
  }, [selected.lat, selected.lon]);

  const pct = selected.probabilityPct ?? 0;
  const color = scoreColor(pct);
  const topSpecies = detail
    ? [...detail.species]
        .map((sp) => ({ sp, today: sp.days.find((d) => d.date === detail.today) }))
        .filter((x): x is { sp: (typeof detail.species)[number]; today: NonNullable<typeof x.today> } => !!x.today)
        .sort((a, b) => b.today.probability_pct - a.today.probability_pct)
        .slice(0, 3)
    : [];
  const first = topSpecies[0]?.today;
  const todayWeather = detail?.weather?.find((w) => w.date === detail.today);

  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Vybraná oblast</Text>
          <Text onPress={onClose} style={styles.close}>
            Zavřít
          </Text>
        </View>

        <View style={styles.indexRow}>
          <Text style={styles.eyebrow}>Houbový index</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color }]}>{pct}</Text>
            <Text style={styles.scoreMax}>/ 100</Text>
          </View>
          <Text style={[styles.status, { color }]}>{scoreLabel(pct)}</Text>
        </View>

        <Text style={styles.listTitle}>Co tu roste</Text>
        {topSpecies.length > 0 ? (
          <View style={{ gap: space.xs }}>
            {topSpecies.map(({ sp, today }) => (
              <Pressable key={sp.id} style={styles.speciesRow} onPress={() => openSpecies(sp.id)}>
                <Text style={styles.speciesName}>{sp.name_cz}</Text>
                <ProbabilityBadge pct={today.probability_pct} size="sm" />
              </Pressable>
            ))}
          </View>
        ) : (
          selected.topSpeciesName && (
            <Pressable
              style={styles.speciesRow}
              onPress={() => selected.topSpeciesId && openSpecies(selected.topSpeciesId)}
            >
              <Text style={styles.speciesName}>{selected.topSpeciesName}</Text>
              {selected.probabilityPct != null && (
                <ProbabilityBadge pct={selected.probabilityPct} size="sm" />
              )}
            </Pressable>
          )
        )}

        {first && todayWeather && (
          <Text style={styles.why}>
            {first.factors.days_since_rain == null
              ? "Delší dobu bez vydatnějšího deště"
              : `${first.factors.days_since_rain}. den po dešti`}
            {" · "}
            {todayWeather.tempC} °C
          </Text>
        )}

        <View style={{ marginTop: space.base }}>
          <PrimaryButton label="Uložit lokalitu" disabled />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: 0, paddingBottom: space.xl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...type.headingMd, color: palette.ink },
  close: { ...type.bodySmall, color: palette.inkFaint },
  indexRow: { marginTop: space.md },
  eyebrow: { ...type.label, color: palette.inkFaint },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 4 },
  score: { ...type.displayLg, fontSize: 32, lineHeight: 32 },
  scoreMax: { ...type.body, color: palette.inkFaint, marginLeft: 4, marginBottom: 2 },
  status: { ...type.bodySmall, marginTop: 2 },
  listTitle: { ...type.label, color: palette.inkFaint, marginTop: space.md, marginBottom: space.xs },
  speciesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: palette.bg,
    borderRadius: radius.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  speciesName: { ...type.body, color: palette.ink },
  why: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.md },
});
