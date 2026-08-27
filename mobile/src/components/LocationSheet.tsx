import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, scoreColor, scoreLabel, space, type } from "../theme";
import { PrimaryButton } from "./PrimaryButton";
import { ProbabilityBadge } from "./ProbabilityBadge";
import { BottomSheet } from "./BottomSheet";
import { getForecast, type ForecastResponse } from "../api";
import { computeDailyOverall } from "../forecastMath";
import { useSpeciesDetail } from "../SpeciesDetailContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { NamePromptModal } from "./NamePromptModal";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";
import { FREE_SAVED_LOCATIONS_LIMIT } from "../subscriptionLimits";
import type { MapMode } from "../leafletHtml";
import { nearestTouristArea } from "../touristAreas";

export interface SelectedLocation {
  lat: number;
  lon: number;
  // The nearest weather-grid point's coordinates - forecast lookups use
  // these (not lat/lon) so repeated taps in the same region reuse the same
  // cached /api/forecast entry instead of each hitting a fresh coordinate.
  gridLat?: number;
  gridLon?: number;
  // Set only when this location came from tapping a saved-location marker
  // (see Moje místa on the map) - the user's own name for that spot, shown
  // instead of the algorithmic nearest-tourist-area guess.
  savedLabel?: string | null;
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
  const { locations: savedLocations, addLocation } = useSavedLocations();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const [justSaved, setJustSaved] = useState(false);
  const [naming, setNaming] = useState(false);

  // Snap to the nearest grid point's coordinates for the forecast fetch
  // (falls back to lat/lon if an older message shape ever lacks these) so
  // repeated taps in the same region reuse the already-cached /api/forecast
  // entry instead of each one hitting a fresh, uncached coordinate.
  const gridLat = selected.gridLat ?? selected.lat;
  const gridLon = selected.gridLon ?? selected.lon;

  useEffect(() => {
    setDetail(null);
    getForecast(gridLat, gridLon)
      .then(setDetail)
      .catch(() => {});
  }, [gridLat, gridLon]);

  // selected.probabilityPct comes from the map's overview grid (points up to
  // ~15km apart - see leafletHtml.ts) and is only a placeholder shown while
  // `detail` loads. Once the real per-species forecast for this exact tapped
  // coordinate arrives, its own overall score (same weighted-top-3 formula
  // api/grid.ts uses) replaces it - otherwise a spot with clearly no real
  // forest nearby (e.g. a city center) could keep showing a nearby forest's
  // score indefinitely, which is exactly the "why does downtown Prague show
  // 54%" bug this fixes.
  const todayOverall = detail ? computeDailyOverall(detail).find((d) => d.date === detail.today)?.overall : undefined;
  const pct = todayOverall ?? selected.probabilityPct ?? 0;
  const color = scoreColor(pct);
  // No free/open source has real "turistická oblast" polygon boundaries
  // (checked Mapy.cz geocoding, OSM, ArcČR 500 - see touristAreas.ts) - the
  // nearest named point is an approximation, but turns a meaningless
  // "Vybraná oblast" into "Vybraná oblast — Žďárské vrchy", which is the
  // whole point of tapping the map to begin with.
  const area = useMemo(() => nearestTouristArea(selected.lat, selected.lon), [selected.lat, selected.lon]);
  const mapyUrl = `https://mapy.com/zakladni?x=${selected.lon}&y=${selected.lat}&z=15&source=coor&id=${selected.lon},${selected.lat}`;
  // Same ~100m dedupe threshold addLocation() itself uses - checked here too
  // so the button can show "Uloženo" instead of silently doing nothing on a
  // second tap of the same spot.
  const alreadySaved = savedLocations.some(
    (p) => Math.abs(p.lat - selected.lat) < 0.001 && Math.abs(p.lon - selected.lon) < 0.001
  );
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
          <Text style={styles.title}>Vybraná oblast — {selected.savedLabel || area.name}</Text>
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
          <PrimaryButton
            label={alreadySaved || justSaved ? "Uloženo." : 'Uložit do "Mých míst"'}
            disabled={alreadySaved || justSaved}
            onPress={() => {
              if (!isPremium && savedLocations.length >= FREE_SAVED_LOCATIONS_LIMIT) {
                openPaywall("Chcete uložit víc než jedno místo?");
                return;
              }
              setNaming(true);
            }}
          />
        </View>
      </View>
      {naming && (
        <NamePromptModal
          title="Jak se to místo jmenuje?"
          initialValue={selected.savedLabel || area.name}
          onCancel={() => setNaming(false)}
          onConfirm={(label) => {
            addLocation({ lat: selected.lat, lon: selected.lon, label });
            setJustSaved(true);
            setNaming(false);
          }}
        />
      )}
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
