import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { palette, radius, space } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { buildMapHtml } from "../leafletHtml";
import { PageHeader } from "../components/PageHeader";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function MapScreen() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon).then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "locationSelected") setSelected(msg);
      } catch {
        // not our message
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
      <PageHeader
        eyebrow="celá ČR"
        title="Mapa"
        subtitle="Zatím jeden bod — grid pro celou republiku je další krok. Klepni na bod pro detail."
      />
      <View style={styles.mapCard}>
        <iframe title="Mapa" srcDoc={html} style={{ width: "100%", height: "100%", border: 0 }} />
      </View>
      {selected && (
        <LocationSheet selected={selected} data={data} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  mapCard: {
    flex: 1,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
});
