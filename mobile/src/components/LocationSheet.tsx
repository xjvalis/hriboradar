import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette, radius, scoreColor, scoreLabel, shadow, space, type } from "../theme";
import { PrimaryButton } from "./PrimaryButton";
import { Chip } from "./Chip";
import { getForecast, type ForecastResponse } from "../api";

export interface SelectedLocation {
  lat: number;
  lon: number;
  probabilityPct: number | null;
  topSpeciesName: string | null;
}

export function LocationSheet({
  selected,
  onClose,
}: {
  selected: SelectedLocation;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(200)).current;
  const [detail, setDetail] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16 }).start();
  }, [selected]);

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
    <Animated.View style={[styles.sheet, shadow.sheet, { transform: [{ translateY }] }]}>
      <View style={styles.handle} />
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

      {topSpecies.length > 0 ? (
        <View style={styles.chipRow}>
          {topSpecies.map(({ sp }) => (
            <Chip key={sp.id} label={sp.name_cz} />
          ))}
        </View>
      ) : (
        selected.topSpeciesName && (
          <View style={styles.chipRow}>
            <Chip label={selected.topSpeciesName} />
          </View>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.lg,
    paddingBottom: space.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    alignSelf: "center",
    marginBottom: space.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...type.headingMd, color: palette.ink },
  close: { ...type.bodySmall, color: palette.inkFaint },
  indexRow: { marginTop: space.md },
  eyebrow: { ...type.label, color: palette.inkFaint },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 4 },
  score: { ...type.displayLg, fontSize: 32, lineHeight: 32 },
  scoreMax: { ...type.body, color: palette.inkFaint, marginLeft: 4, marginBottom: 2 },
  status: { ...type.bodySmall, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  why: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.md },
});
