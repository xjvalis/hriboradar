import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { REGIONS } from "../regions";
import { useLocation } from "../LocationContext";
import { IndexCard } from "../components/IndexCard";
import { SectionHeader } from "../components/SectionHeader";
import { LocationCard } from "../components/LocationCard";
import { MushroomCard } from "../components/MushroomCard";
import { WeatherSummary } from "../components/WeatherSummary";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { LoadingScreen } from "../components/LoadingScreen";

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

function buildExplanation(data: ForecastResponse, top: ReturnType<typeof topSpeciesOf>) {
  const names = top.slice(0, 2).map((x) => x.sp.name_cz).join(" a ");
  const since = top[0]?.today.factors.days_since_rain;
  const rainPart =
    since == null
      ? "Delší dobu bez vydatnějšího deště"
      : since <= 2
        ? "Nedávno pršelo, půda ještě sytí"
        : `${since}. den po posledním vydatnějším dešti`;
  return `${rainPart}. Nejlepší podmínky mají teď ${names || "mykorhizní druhy"}.`;
}

export default function HomeScreen() {
  const { location } = useLocation();
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regionResults, setRegionResults] = useState<RegionResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  function loadMain() {
    setData(null);
    setError(null);
    getForecast(location.lat, location.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }

  function loadRegions() {
    // The 8 "Kam dnes?" regions are fixed, real places — independent of
    // whatever location the user is currently looking at.
    Promise.all(
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
  useEffect(loadMain, [location.lat, location.lon]);
  useEffect(loadRegions, []);

  const top = data ? topSpeciesOf(data) : [];
  const indexValue = top.length
    ? Math.round(top.slice(0, 5).reduce((s, x) => s + x.today.probability_pct, 0) / Math.min(5, top.length))
    : 0;
  const todayWeather = data?.weather?.find((w) => w.date === data.today);
  const daysSinceRainToday = top[0]?.today.factors.days_since_rain ?? null;

  // First load: the fun full-screen version, not a bare spinner or an
  // empty page — this is the 3-10s window the whole app was waiting
  // silently through before caching + this screen existed.
  if (!data && !error) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadMain();
            loadRegions();
            setTimeout(() => setRefreshing(false), 800);
          }}
          tintColor={palette.primary}
        />
      }
    >
      <Text style={styles.eyebrow}>dnes v okolí · {location.label}</Text>
      <Text style={styles.headline}>Houby venku</Text>

      {error && (
        <Text style={styles.error}>
          Nepodařilo se načíst předpověď: {error}
          {"\n"}Běží `npm run dev:api` v kořeni repa?
        </Text>
      )}

      {data && (
        <View style={{ marginTop: space.base }}>
          <IndexCard value={indexValue} explanation={buildExplanation(data, top)} />
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
            tempC={todayWeather.tempC}
            soilMoisturePct={todayWeather.soilMoisturePct}
            daysSinceRain={daysSinceRainToday}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.base, paddingBottom: space.xxl },
  eyebrow: { ...type.eyebrow, color: palette.secondary },
  headline: { ...type.displayXl, color: palette.ink, marginTop: 2 },
  error: { ...type.bodySmall, color: palette.danger, marginTop: space.base },
});
