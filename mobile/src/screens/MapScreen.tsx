import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { palette, radius, space, type } from "../theme";
import { getGrid, API_BASE, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { type MapMode } from "../leafletHtml";
import { useAppNavigation } from "../AppNavigationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

export default function MapScreen() {
  const { location } = useLocation();
  const { consumeMapSpeciesRequest, consumeMapFocusRequest } = useAppNavigation();
  const { locations: savedLocations } = useSavedLocations();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  // MapScreen fully remounts each time the user navigates here (App.tsx
  // swaps screens, it doesn't keep them mounted offscreen), so a lazy
  // initializer is enough to pick up a pending "Ukázat na mapě" request -
  // no effect/race needed. Captured once into a ref too, so the initial
  // species can be baked into mapUri below (see why in that comment)
  // without mapUri also depending on `mode`, which changes on every chip
  // tap and would otherwise reload the whole WebView each time.
  const initialSpeciesRef = useRef<string | null>(null);
  const [mode, setMode] = useState<MapMode>(() => {
    const pending = consumeMapSpeciesRequest();
    if (!pending) return { type: "overall" };
    initialSpeciesRef.current = pending;
    return { type: "species", id: pending };
  });
  // "Kam dnes?" already points `location` itself at the region (see
  // HomeScreen.goToRegionOnMap), so lat/lon in mapUri below are already
  // right - this only needs to carry the extra "and zoom in" instruction.
  const initialZoomRef = useRef<number | null | undefined>(undefined);
  if (initialZoomRef.current === undefined) {
    initialZoomRef.current = consumeMapFocusRequest()?.zoom ?? null;
  }
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const isFirstMode = useRef(true);

  useEffect(() => {
    getGrid()
      .then(setGrid)
      .catch((e) => {
        console.error("[MapScreen] Grid fetch error:", e);
        setGridError(String(e.message ?? e));
      });
  }, []);

  // /api/map always renders in "overall" mode server-side (it has no way
  // to know about client-only navigation state) - a species chip tapped
  // after the page loads reaches it fine via postMessage below, but an
  // *initial* species mode needs to be baked into the URL itself. Posting
  // it via postMessage instead would race the WebView's own page-load: if
  // the message arrives before the page's listener is registered, it's
  // just dropped, and the map silently opens in the wrong mode.
  const mapUri = useMemo(() => {
    let uri = `${API_BASE}/api/map?lat=${location.lat}&lon=${location.lon}`;
    if (initialSpeciesRef.current) uri += `&species=${encodeURIComponent(initialSpeciesRef.current)}`;
    if (initialZoomRef.current) uri += `&fzoom=${initialZoomRef.current}`;
    return uri;
  }, [location.lat, location.lon]);

  // Same "wait for the page's own ready signal" reasoning as MapScreen.web -
  // /api/map is a public, unauthenticated endpoint, so it has no way to bake
  // the signed-in user's saved locations into the initial HTML the way
  // points/speciesList are; they only arrive after the page loads.
  useEffect(() => setMapReady(false), [mapUri]);

  useEffect(() => {
    if (isFirstMode.current) {
      isFirstMode.current = false;
      return;
    }
    webviewRef.current?.postMessage(JSON.stringify({ type: "setMode", mode }));
  }, [mode]);

  useEffect(() => {
    if (!mapReady) return;
    webviewRef.current?.postMessage(JSON.stringify({ type: "setSavedLocations", locations: savedLocations }));
  }, [mapReady, savedLocations]);

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
        {gridError || webviewError ? (
          <View style={styles.centerOverlay}>
            <Text style={styles.error}>
              Mapu se nepodařilo načíst: {gridError ?? webviewError}
              {"\n"}Je telefon na stejné Wi-Fi jako server?
            </Text>
          </View>
        ) : !grid ? (
          <View style={styles.centerOverlay}>
            <Text style={styles.loading}>Načítám data z API…</Text>
          </View>
        ) : (
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ uri: mapUri }}
            // borderRadius/overflow live here, on the WebView itself, not on
            // a wrapping View - on iOS, clipping a WebView via an ancestor's
            // overflow:hidden+borderRadius can make its native layer fail to
            // composite at all (not just fail to round its corners).
            //
            // mapCard no longer uses alignItems/justifyContent (that's what
            // centerOverlay is for now) so this WebView gets RN's default
            // cross-axis behavior, alignItems: "stretch", with no ambiguity.
            style={{ flex: 1, borderRadius: radius.lg, overflow: "hidden" }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <Text style={styles.loading}>Počítám mřížku pro celou republiku…</Text>
              </View>
            )}
            onError={(e) => setWebviewError(e.nativeEvent.description)}
            onHttpError={(e) => setWebviewError(`HTTP ${e.nativeEvent.statusCode}`)}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === "locationSelected") setSelected(msg);
                else if (msg.type === "ready") setMapReady(true);
                else if (msg.type === "jsError") {
                  setWebviewError(`Chyba na stránce mapy: ${msg.message}`);
                } else if (msg.type === "tileError") {
                  setWebviewError("Nepodařilo se stáhnout mapové dlaždice - má telefon přístup k internetu?");
                }
              } catch {
                // not our message
              }
            }}
          />
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
    borderWidth: 1,
    borderColor: palette.line,
    // No alignItems/justifyContent here on purpose - this View's only child
    // when a map is shown is the WebView, and centering (via
    // alignItems: "center") collapses a flex:1 child with no intrinsic
    // width to zero cross-axis width. The loading/error states use their
    // own centerOverlay/loadingWrap instead.
  },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  loading: { ...type.bodySmall, color: palette.inkFaint },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
  },
  error: { ...type.bodySmall, color: palette.danger, textAlign: "center", paddingHorizontal: space.lg },
});
