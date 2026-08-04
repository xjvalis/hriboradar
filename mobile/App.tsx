import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, scoreColor } from "./src/theme";
import { getForecast, type ForecastResponse, type SpeciesForecast } from "./src/api";
import { MapIcon, HomeIcon, BookIcon, PinIcon } from "./src/icons";
import { MushroomThumb } from "./src/photos";
import { MapCard } from "./src/MapCard";

// Prague, until location permission + a real picker are wired up.
const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function App() {
  const [fontsLoaded] = useFonts({
    "Fraunces-SemiBold": require("./assets/fonts/Fraunces-SemiBold.ttf"),
    "Fraunces-Bold": require("./assets/fonts/Fraunces-Bold.ttf"),
    "Nunito-Regular": require("./assets/fonts/Nunito-Regular.ttf"),
    "Nunito-Bold": require("./assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("./assets/fonts/Nunito-ExtraBold.ttf"),
  });

  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  }

  const todaySpecies = (data?.species ?? [])
    .map((sp: SpeciesForecast) => ({
      sp,
      today: sp.days.find((d) => d.date === data?.today),
    }))
    .filter((x): x is { sp: SpeciesForecast; today: NonNullable<typeof x.today> } => !!x.today)
    .sort((a, b) => b.today.probability_pct - a.today.probability_pct);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Rostou?</Text>
          <Text style={styles.tagline}>pravděpodobnost růstu</Text>
        </View>
        <View style={styles.navIcons}>
          <View style={styles.navIcon}>
            <MapIcon />
          </View>
          <View style={[styles.navIcon, styles.navIconActive]}>
            <HomeIcon color={colors.surface} />
          </View>
          <View style={styles.navIcon}>
            <BookIcon />
          </View>
          <View style={styles.navIcon}>
            <PinIcon />
          </View>
        </View>
      </View>
      <View style={styles.headerRule} />

      <FlatList
        data={todaySpecies}
        keyExtractor={(item) => item.sp.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>dnes v okolí</Text>
            <Text style={styles.title}>Houby venku</Text>
            <Text style={styles.subtitle}>
              {data
                ? `Praha (výchozí) · ${data.location.lat}, ${data.location.lon}`
                : "Načítám polohu…"}
            </Text>

            {error && (
              <Text style={styles.error}>
                Nepodařilo se načíst předpověď: {error}
                {"\n"}Běží `npm run dev:api` v kořeni repa?
              </Text>
            )}
            {!data && !error && (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.green} />
            )}

            {data && <MapCard />}
            {data && <Text style={styles.sectionTitle}>Podle pravděpodobnosti dnes</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <MushroomThumb id={item.sp.id} name={item.sp.name_cz} size={56} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardName}>{item.sp.name_cz}</Text>
              <Text style={styles.cardLatin}>{item.sp.name_latin}</Text>
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: scoreColor(item.today.probability_pct) },
              ]}
            >
              <Text style={styles.pillText}>{item.today.probability_pct} %</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centerScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  brand: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  tagline: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 11, color: colors.inkSoft },
  navIcons: { flexDirection: "row", gap: 6 },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconActive: { backgroundColor: colors.green, borderColor: colors.green },
  headerRule: { borderTopWidth: 1, borderTopColor: colors.line, marginHorizontal: 18 },
  eyebrow: {
    fontFamily: fonts.serif,
    fontStyle: "italic",
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 18,
  },
  title: { fontFamily: fonts.serifBold, fontSize: 23, color: colors.ink, marginTop: 2 },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontStyle: "italic",
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 20,
    marginBottom: 10,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.scorePoor,
    marginTop: 16,
  },
  list: { paddingHorizontal: 18, paddingBottom: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
  },
  cardName: { fontFamily: fonts.serif, fontSize: 15, color: colors.ink },
  cardLatin: { fontFamily: fonts.sans, fontStyle: "italic", fontSize: 11, color: colors.inkFaint },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: fonts.sansExtraBold, fontSize: 12, color: "#fff" },
});
