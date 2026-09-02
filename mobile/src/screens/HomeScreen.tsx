import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { palette, radius, scoreFlavor, space, ts, type } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { computeDailyOverall } from "../forecastMath";
import { REGIONS } from "../regions";
import { useLocation } from "../LocationContext";
import { useAppNavigation } from "../AppNavigationContext";
import { IndexCard } from "../components/IndexCard";
import { SectionHeader } from "../components/SectionHeader";
import { LocationCard } from "../components/LocationCard";
import { MushroomCard } from "../components/MushroomCard";
import { WeatherSummary } from "../components/WeatherSummary";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { LoadingScreen } from "../components/LoadingScreen";
import { PaperBackground } from "../components/PaperBackground";
import { CurrentLocationPill } from "../components/CurrentLocationPill";

interface RegionResult {
  region: (typeof REGIONS)[number];
  topSpecies: string;
  probabilityPct: number;
}

function topSpeciesOf(data: ForecastResponse) {
  return data.species
    .map((sp) => ({ sp, today: sp.days.find((d) => d.date === data.today) }))
    .filter((x): x is { sp: (typeof data.species)[number]; today: NonNullable<typeof x.today> } => !!x.today)
    .sort((a, b) => b.today.probability_pct - a.today.probability_pct);
}

// A low score caused by standing in a built-up area (see URBAN_PENALTY in
// lib/scoring.ts) reads as a non-sequitur next to "špatné podmínky" - the
// weather/season factors can be perfectly fine, it's just that a train
// station concourse isn't a forest. Worth its own copy rather than the
// generic weather explanation, with the obvious next step spelled out.
function urbanExplanation(indexValue: number): string {
  return `${scoreFlavor(indexValue)} - jste spíš v zástavbě než v lese. Zkuste to o pár kilometrů dál, tam mají houby lepší podmínky k růstu než na chodníku.`;
}

function buildExplanation(data: ForecastResponse, top: ReturnType<typeof topSpeciesOf>, indexValue: number) {
  if (data.terrain.isUrban) return urbanExplanation(indexValue);
  const names = top.slice(0, 2).map((x) => x.sp.name_cz).join(" a ");
  const since = top[0]?.today.factors.days_since_rain;
  const rainPart =
    since == null
      ? "delší dobu bez vydatnějšího deště"
      : since <= 2
        ? "nedávno pršelo, půda ještě sytí"
        : `${since}. den po posledním vydatnějším dešti`;
  return `${scoreFlavor(indexValue)} - ${rainPart}. Nejlepší podmínky mají teď ${names || "mykorhizní druhy"}.`;
}

export default function HomeScreen() {
  const { location, setLocation } = useLocation();
  const { setActive, requestMapFocus } = useAppNavigation();

  function goToRegionOnMap(region: (typeof REGIONS)[number]) {
    setLocation({ lat: region.lat, lon: region.lon, label: region.name });
    requestMapFocus(region.lat, region.lon);
    setActive("Mapa");
  }
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regionResults, setRegionResults] = useState<RegionResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  function loadMain() {
    setData(null);
    setError(null);
    return getForecast(location.lat, location.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }

  function loadRegions() {
    // The 8 "Kam dnes?" regions are fixed, real places - independent of
    // whatever location the user is currently looking at.
    return Promise.all(
      REGIONS.map((region) =>
        getForecast(region.lat, region.lon)
          .then((res) => {
            const top = topSpeciesOf(res)[0];
            if (!top) return null;
            return { region, topSpecies: top.sp.name_cz, probabilityPct: top.today.probability_pct };
          })
          .catch(() => null)
      )
    ).then((results) => {
      const ok = results.filter((r): r is RegionResult => !!r);
      ok.sort((a, b) => b.probabilityPct - a.probabilityPct);
      setRegionResults(ok);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void loadMain(), [location.lat, location.lon]);
  useEffect(() => void loadRegions(), []);

  const top = data ? topSpeciesOf(data) : [];
  // Same weighted-top-3 formula as Předpověď's daily cards (forecastMath.ts,
  // mirroring api/grid.ts's overallScore()) - using a different average here
  // would show a different number for the same day/location on each screen.
  const indexValue = data ? computeDailyOverall(data).find((d) => d.date === data.today)?.overall ?? 0 : 0;
  const todayWeather = data?.weather?.find((w) => w.date === data.today);
  const daysSinceRainToday = top[0]?.today.factors.days_since_rain ?? null;

  // First load: the fun full-screen version, not a bare spinner or an
  // empty page - this is the 3-10s window the whole app was waiting
  // silently through before caching + this screen existed.
  if (!data && !error) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            Promise.all([loadMain(), loadRegions()]).finally(() => setRefreshing(false));
          }}
          tintColor={palette.primary}
        />
      }
    >
      <PaperBackground style={styles.content}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>dnes v okolí</Text>
          <CurrentLocationPill />
        </View>
        <Text style={styles.headline}>Rostou?</Text>

        {error && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>Příliš mnoho požadavků - načtěte stránku znovu.</Text>
            <Pressable
              style={styles.errorRetryButton}
              onPress={() => {
                setRefreshing(true);
                Promise.all([loadMain(), loadRegions()]).finally(() => setRefreshing(false));
              }}
              accessibilityRole="button"
              accessibilityLabel="Načíst znovu"
              hitSlop={8}
            >
              <RefreshCw size={ts(16)} strokeWidth={2} color={palette.surface} />
            </Pressable>
          </View>
        )}

        {data && (
          <View style={{ marginTop: space.base }}>
            <IndexCard value={indexValue} explanation={buildExplanation(data, top, indexValue)} />
          </View>
        )}

        <SectionHeader title="Kam dnes?" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {regionResults.length === 0
            ? [0, 1, 2].map((i) => <View key={i} style={{ width: 220 }}><CardSkeleton /></View>)
            : regionResults.map((r) => (
                <LocationCard
                  key={r.region.id}
                  name={r.region.name}
                  region={r.region.area}
                  topSpecies={r.topSpecies}
                  probabilityPct={r.probabilityPct}
                  onPress={() => goToRegionOnMap(r.region)}
                />
              ))}
        </ScrollView>

        <SectionHeader title="Co roste dnes" />
        <View style={{ gap: space.sm }}>
          {top.length === 0
            ? [0, 1, 2].map((i) => <CardSkeleton key={i} />)
            : top.slice(0, 6).map(({ sp, today }) => (
                <MushroomCard
                  key={sp.id}
                  id={sp.id}
                  nameCz={sp.name_cz}
                  nameLatin={sp.name_latin}
                  probabilityPct={today.probability_pct}
                />
              ))}
        </View>

        {todayWeather && (
          <>
            <SectionHeader title="Podmínky" />
            <WeatherSummary
              tempC={data?.current?.tempC ?? todayWeather.tempC}
              soilMoisturePct={todayWeather.soilMoisturePct}
              daysSinceRain={daysSinceRainToday}
            />
          </>
        )}
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.base, paddingBottom: space.xxl },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  eyebrow: { ...type.eyebrow, color: palette.secondary },
  headline: { ...type.displayXl, color: palette.ink, marginTop: 2 },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    backgroundColor: palette.danger,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    marginTop: space.base,
  },
  errorText: { ...type.bodySmall, color: palette.surface, flex: 1 },
  errorRetryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000022",
  },
});
