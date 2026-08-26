import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { getGrid, API_BASE, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { buildGridMapHtml, type MapMode } from "../leafletHtml";
import { useAppNavigation } from "../AppNavigationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";
import { LoadingProgress } from "../components/LoadingProgress";

export default function MapScreen() {
  const { location } = useLocation();
  const { consumeMapSpeciesRequest, consumeMapFocusRequest, active } = useAppNavigation();
  const { locations: savedLocations } = useSavedLocations();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>({ type: "overall" });
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        else if (msg.type === "ready") setMapReady(true);
      } catch {
        // not our message
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The HTML is built once per (grid, location) - NOT per mode. Switching
  // species shouldn't reload every map tile and reset pan/zoom; instead the
  // mode change is pushed into the already-loaded page below. App.tsx now
  // keeps every screen mounted permanently (just hidden), so this iframe is
  // no longer guaranteed to remount when the user switches to Mapa -
  // initialMode/initialView used to be baked in here for exactly that
  // "guaranteed fresh page" case; now a return visit reuses the same
  // already-loaded iframe, so pending requests instead flow through the
  // postMessage effect below every time, the same way a mid-session chip
  // tap already did.
  const html = useMemo(() => {
    if (!grid) return null;
    return buildGridMapHtml({
      points: grid.points,
      speciesList: grid.speciesList,
      userLat: location.lat,
      userLon: location.lon,
      apiBase: API_BASE,
      mapApiKey: process.env.EXPO_PUBLIC_MAPY_CZ_API_KEY ?? "",
    });
  }, [grid, location.lat, location.lon]);

  // A fresh srcDoc means a fresh page - its own "ready" message hasn't
  // arrived yet, so posting setSavedLocations right away would race the
  // new page's listener.
  useEffect(() => setMapReady(false), [html]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "setMode", mode }), "*");
  }, [mode]);

  useEffect(() => {
    if (!mapReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: "setSavedLocations", locations: savedLocations }),
      "*"
    );
  }, [mapReady, savedLocations]);

  // Picks up a "Ukázat na mapě" species jump or a "Kam dnes?" region focus
  // whenever the user is actually looking at Mapa AND its page has loaded
  // far enough to have a message listener registered - re-running this
  // check on every dependency change is safe since consume*Request() is a
  // no-op once already drained, so it can't double-apply a stale request.
  useEffect(() => {
    if (active !== "Mapa" || !mapReady) return;
    const pendingSpecies = consumeMapSpeciesRequest();
    if (pendingSpecies) setMode({ type: "species", id: pendingSpecies });
    const pendingFocus = consumeMapFocusRequest();
    if (pendingFocus) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: "focusView", lat: pendingFocus.lat, lon: pendingFocus.lon, zoom: pendingFocus.zoom }),
        "*"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mapReady]);

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
          <View style={{ alignItems: "center" }}>
            <Text style={styles.loading}>Počítám mřížku pro celou republiku…</Text>
            <LoadingProgress />
          </View>
        )}
      </View>
      {selected && <LocationSheet selected={selected} mode={mode} onClose={() => setSelected(null)} />}
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
