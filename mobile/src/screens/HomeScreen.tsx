import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, scoreColor } from "../theme";
import { getForecast, type ForecastResponse, type SpeciesForecast } from "../api";
import { MushroomThumb } from "../photos";

// Prague, until location permission + a real picker are wired up.
const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function HomeScreen() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const todaySpecies = (data?.species ?? [])
    .map((sp: SpeciesForecast) => ({
      sp,
      today: sp.days.find((d) => d.date === data?.today),
    }))
    .filter((x): x is { sp: SpeciesForecast; today: NonNullable<typeof x.today> } => !!x.today)
    .sort((a, b) => b.today.probability_pct - a.today.probability_pct);

  return (
    <SafeAreaView style={styles.screen}>
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
            <View style={[styles.pill, { backgroundColor: scoreColor(item.today.probability_pct) }]}>
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
  eyebrow: {
    fontFamily: fonts.serif,
    fontStyle: "italic",
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 8,
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
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.scorePoor, marginTop: 16 },
  list: { paddingHorizontal: 18, paddingBottom: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    shadowColor: "#5A3E1C",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardName: { fontFamily: fonts.serif, fontSize: 15, color: colors.ink },
  cardLatin: { fontFamily: fonts.sans, fontStyle: "italic", fontSize: 11, color: colors.inkFaint },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: fonts.sansExtraBold, fontSize: 12, color: "#fff" },
});
