import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { palette, radius, space, type } from "../theme";
import { getGrid, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { buildGridMapHtml, type MapMode } from "../leafletHtml";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

export default function MapScreen() {
  const { location } = useLocation();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [mode, setMode] = useState<MapMode>({ type: "top3" });
  const [selected, setSelected] = useState<SelectedLocation | null>(null);

  useEffect(() => {
    getGrid().then(setGrid).catch(() => {});
  }, []);

  const html = useMemo(() => {
    if (!grid) return null;
    return buildGridMapHtml({
      points: grid.points,
      speciesList: grid.speciesList,
      mode,
      userLat: location.lat,
      userLon: location.lon,
    });
  }, [grid, mode, location.lat, location.lon]);

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="celá ČR · dnes"
        title="Mapa"
        subtitle="Hustota mraku = pravděpodobnost. Klepni na mapu pro detail místa."
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: space.sm }}>
        <Chip
          label="Top 3 dnes"
          active={mode.type === "top3"}
          onPress={() => setMode({ type: "top3" })}
        />
        {grid?.speciesList.map((sp) => (
          <Chip
            key={sp.id}
            label={sp.name_cz}
            active={mode.type === "species" && mode.id === sp.id}
            onPress={() => setMode({ type: "species", id: sp.id })}
          />
        ))}
      </ScrollView>

      <View style={styles.mapCard}>
        {html ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1 }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === "locationSelected") setSelected(msg);
              } catch {
                // not our message
              }
            }}
          />
        ) : (
          <Text style={styles.loading}>Počítám mřížku pro celou republiku…</Text>
        )}
      </View>
      {selected && <LocationSheet selected={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  filters: { flexGrow: 0, paddingHorizontal: space.lg, marginBottom: space.sm },
  mapCard: {
    flex: 1,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { ...type.bodySmall, color: palette.inkFaint },
});
