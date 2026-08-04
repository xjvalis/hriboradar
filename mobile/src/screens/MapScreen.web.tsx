import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { buildMapHtml } from "../leafletHtml";

const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function MapScreen() {
  const [data, setData] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon).then(setData).catch(() => {});
  }, []);

  const top = data?.species
    .map((sp) => ({ sp, today: sp.days.find((d) => d.date === data.today) }))
    .filter((x) => x.today)
    .sort((a, b) => b.today!.probability_pct - a.today!.probability_pct)[0];

  const html = buildMapHtml({
    lat: DEFAULT_LOCATION.lat,
    lon: DEFAULT_LOCATION.lon,
    probabilityPct: top?.today?.probability_pct,
    topSpeciesName: top?.sp.name_cz,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>celá ČR</Text>
        <Text style={styles.title}>Mapa</Text>
        <Text style={styles.subtitle}>
          Zatím jen jeden bod (výchozí poloha) — grid pro celou republiku je další krok.
        </Text>
      </View>
      <View style={styles.mapCard}>
        {/* Real Leaflet map, same tiles as the reference — react-native-maps
            has no web target, so this is the approach that works in both
            the web preview and (via WebView) the native app. */}
        <iframe
          title="Mapa"
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 13, color: colors.inkSoft },
  title: { fontFamily: fonts.serifBold, fontSize: 23, color: colors.ink, marginTop: 2 },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 4 },
  mapCard: {
    flex: 1,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
});
