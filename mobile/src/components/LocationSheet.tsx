import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, scoreColor, scoreLabel, space, type } from "../theme";
import { PrimaryButton } from "./PrimaryButton";
import { ProbabilityBadge } from "./ProbabilityBadge";
import { BottomSheet } from "./BottomSheet";
import { getForecast, type ForecastResponse } from "../api";
import { useSpeciesDetail } from "../SpeciesDetailContext";
import type { MapMode } from "../leafletHtml";
import { nearestTouristArea } from "../touristAreas";

export interface SelectedLocation {
  lat: number;
  lon: number;
  probabilityPct: number | null;
  topSpeciesName: string | null;
  topSpeciesId: string | null;
}

export function LocationSheet({
  selected,
  mode,
  onClose,
}: {
  selected: SelectedLocation;
  mode?: MapMode;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ForecastResponse | null>(null);
  const { openSpecies } = useSpeciesDetail();

  useEffect(() => {
    setDetail(null);
    // The point tapped comes straight from /api/grid, which already
    // computed & cached weather+terrain for this exact coordinate - this
    // fetch almost always resolves from cache, not a fresh lookup.
    getForecast(selected.lat, selected.lon)
      .then(setDetail)
      .catch(() => {});
  }, [selected.lat, selected.lon]);

  const pct = selected.probabilityPct ?? 0;
  const color = scoreColor(pct);
  // No free/open source has real "turistická oblast" polygon boundaries
  // (checked Mapy.cz geocoding, OSM, ArcČR 500 - see touristAreas.ts) - the
  // nearest named point is an approximation, but turns a meaningless
  // "Vybraná oblast" into "Vybraná oblast — Žďárské vrchy", which is the
  // whole point of tapping the map to begin with.
  const area = useMemo(() => nearestTouristArea(selected.lat, selected.lon), [selected.lat, selected.lon]);
  const mapyUrl = `https://mapy.com/zakladni?x=${selected.lon}&y=${selected.lat}&z=15&source=coor&id=${selected.lon},${selected.lat}`;
  const topSpecies = detail
    ? [...detail.species]
        .map((sp) => ({ sp, today: sp.days.find((d) => d.date === detail.today) }))
        .filter((x): x is { sp: (typeof detail.species)[number]; today: NonNullable<typeof x.today> } => !!x.today)
        .sort((a, b) => b.today.probability_pct - a.today.probability_pct)
        .slice(0, 3)
    : [];
  const first = topSpecies[0]?.today;
  const todayWeather = detail?.weather?.find((w) => w.date === detail.today);

  // When the map's chip filter is set to a single species (not "Všechny
  // houby"), that's the reason the user is looking at this exact spot - the
  // ranked "Co tu roste" list alone doesn't say anything about it if it
  // didn't happen to place in the top 3.
  const filteredSpecies =
    mode?.type === "species"
      ? detail?.species.find((sp) => sp.id === mode.id)
      : undefined;
  const filteredToday = filteredSpecies?.days.find((d) => d.date === detail?.today);

  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Vybraná oblast — {area.name}</Text>
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

        {filteredSpecies && filteredToday && (
          <Pressable style={styles.filteredRow} onPress={() => openSpecies(filteredSpecies.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filteredEyebrow}>Vybraný filtr</Text>
              <Text style={styles.filteredName}>{filteredSpecies.name_cz}</Text>
            </View>
            <ProbabilityBadge pct={filteredToday.probability_pct} size="md" />
          </Pressable>
        )}

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
            {detail?.current?.tempC ?? todayWeather.tempC} °C
          </Text>
        )}

        <Pressable onPress={() => Linking.openURL(mapyUrl)} style={styles.mapyLink}>
          <Text style={styles.mapyLinkText}>Otevřít přesné místo v Mapy.cz</Text>
        </Pressable>

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
  filteredRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.md,
    padding: space.sm,
    backgroundColor: palette.primary + "14",
    borderWidth: 1,
    borderColor: palette.primary + "33",
    borderRadius: radius.md,
  },
  filteredEyebrow: { ...type.label, color: palette.primaryDeep },
  filteredName: { ...type.headingSm, color: palette.ink, marginTop: 2 },
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
  mapyLink: { marginTop: space.md, alignItems: "center" },
  mapyLinkText: { ...type.bodySmall, color: palette.primaryDeep, textDecorationLine: "underline" },
});
