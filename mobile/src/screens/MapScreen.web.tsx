import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { getGrid, GRID_THRESHOLD_PCT, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { buildGridMapHtml } from "../leafletHtml";
import { PageHeader } from "../components/PageHeader";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

export default function MapScreen() {
  const { location } = useLocation();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);

  useEffect(() => {
    getGrid().then(setGrid).catch(() => {});
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

  const html = grid
    ? buildGridMapHtml({
        points: grid.points,
        gridSpacingM: grid.gridSpacingM,
        userLat: location.lat,
        userLon: location.lon,
      })
    : null;

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow={`celá ČR · nad ${GRID_THRESHOLD_PCT} %`}
        title="Mapa"
        subtitle="Oblasti, ne přesné body — model počítá pravděpodobnost pro okolí, ne pro jeden metr čtvereční."
      />
      <View style={styles.mapCard}>
        {html ? (
          <iframe title="Mapa" srcDoc={html} style={{ width: "100%", height: "100%", border: 0 }} />
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
