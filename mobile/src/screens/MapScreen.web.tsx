import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { getGrid, API_BASE, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { buildGridMapHtml, type MapMode } from "../leafletHtml";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

export default function MapScreen() {
  const { location } = useLocation();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>({ type: "overall" });
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isFirstMode = useRef(true);

  useEffect(() => {
    getGrid()
      .then(setGrid)
      .catch((e) => setGridError(String(e.message ?? e)));
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

  // The HTML is built once per (grid, location) - NOT per mode. Switching
  // species shouldn't reload every map tile and reset pan/zoom; instead the
  // mode change is pushed into the already-loaded page below.
  const html = useMemo(() => {
    if (!grid) return null;
    return buildGridMapHtml({
      points: grid.points,
      speciesList: grid.speciesList,
      userLat: location.lat,
      userLon: location.lon,
      initialMode: mode,
      apiBase: API_BASE,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, location.lat, location.lon]);

  useEffect(() => {
    if (isFirstMode.current) {
      isFirstMode.current = false;
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "setMode", mode }), "*");
  }, [mode]);

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="celá ČR · dnes"
        title="Mapa"
        subtitle="Hustota mraku = pravděpodobnost. Klepni na mapu pro detail místa."
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: space.sm }}>
        <Chip
          label="Všechny houby"
          active={mode.type === "overall"}
          onPress={() => setMode({ type: "overall" })}
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
        {gridError ? (
          <Text style={styles.error}>Mapu se nepodařilo načíst: {gridError}</Text>
        ) : html ? (
          <iframe ref={iframeRef} title="Mapa" srcDoc={html} style={{ width: "100%", height: "100%", border: 0 }} />
        ) : (
          <Text style={styles.loading}>Počítám mřížku pro celou republiku…</Text>
        )}
      </View>
      {selected && <LocationSheet selected={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  error: { ...type.bodySmall, color: palette.danger, textAlign: "center", paddingHorizontal: space.lg },
});
