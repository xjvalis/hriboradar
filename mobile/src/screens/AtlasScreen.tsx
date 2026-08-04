import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { MushroomThumb } from "../photos";

const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function AtlasScreen() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const sorted = [...(data?.species ?? [])].sort((a, b) =>
    a.name_cz.localeCompare(b.name_cz, "cs")
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={sorted}
        keyExtractor={(sp) => sp.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>všech {data?.species.length ?? 15} druhů</Text>
            <Text style={styles.title}>Atlas hub</Text>
            {error && <Text style={styles.error}>Nepodařilo se načíst atlas: {error}</Text>}
            {!data && !error && <ActivityIndicator style={{ marginTop: 24 }} color={colors.green} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <MushroomThumb id={item.id} name={item.name_cz} size={56} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardName}>{item.name_cz}</Text>
              <Text style={styles.cardLatin}>{item.name_latin}</Text>
              <Text style={styles.cardEdibility}>{item.edibility}</Text>
            </View>
          </View>
        )}
      />
    </View>
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
  title: { fontFamily: fonts.serifBold, fontSize: 23, color: colors.ink, marginTop: 2, marginBottom: 14 },
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
  cardEdibility: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.green, marginTop: 3 },
});
