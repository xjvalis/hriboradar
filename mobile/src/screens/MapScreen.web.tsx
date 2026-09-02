import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Info } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { API_BASE, type GridResponse } from "../api";
import { fetchJsonWithProgress } from "../xhrProgress";
import { useLocation } from "../LocationContext";
import { buildGridMapHtml, type MapMode } from "../leafletHtml";
import { useAppNavigation } from "../AppNavigationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";
import { LoadingProgress } from "../components/LoadingProgress";
import { CurrentLocationPill } from "../components/CurrentLocationPill";
import { MapInfoSheet } from "../components/MapInfoSheet";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";

export default function MapScreen() {
  const { location } = useLocation();
  const { consumeMapSpeciesRequest, consumeMapFocusRequest, active } = useAppNavigation();
  const { locations: savedLocations } = useSavedLocations();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { openPaywall } = usePaywall();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridProgress, setGridProgress] = useState(0);
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>({ type: "overall" });
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Captured once, not tracked live - see the `html` useMemo below.
  const initialLocationRef = useRef(location);

  useEffect(() => {
    fetchJsonWithProgress<GridResponse>(`${API_BASE}/api/grid`, setGridProgress)
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
  // Deliberately doesn't track `location` live - see MapScreen.tsx's mapUri
  // comment for the reload/postMessage race this caused (2026-09-01) when
  // it did: "Kam dnes?" changes `location` and requests a map focus in the
  // same tick, and a live-tracked `html` here would rebuild the iframe's
  // srcDoc right as the focus-consuming effect below tries to apply the
  // pending request, dropping it.
  const html = useMemo(() => {
    if (!grid) return null;
    return buildGridMapHtml({
      points: grid.points,
      speciesList: grid.speciesList,
      userLat: initialLocationRef.current.lat,
      userLon: initialLocationRef.current.lon,
      apiBase: API_BASE,
      mapApiKey: process.env.EXPO_PUBLIC_MAPY_CZ_API_KEY ?? "",
    });
  }, [grid]);

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
    if (pendingSpecies) {
      // See MapScreen.tsx's matching comment - skip the paywall while
      // subscriptionLoading is still unsettled rather than falsely gating
      // a genuinely premium account on a fresh app open.
      if (isPremium) setMode({ type: "species", id: pendingSpecies });
      else if (!subscriptionLoading) openPaywall("Chcete vidět mapu podle konkrétní houby?");
    }
    const pendingFocus = consumeMapFocusRequest();
    if (pendingFocus) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: "focusView", lat: pendingFocus.lat, lon: pendingFocus.lon, zoom: pendingFocus.zoom }),
        "*"
      );
    } else {
      // No specific region requested - still tells the page it's actually
      // visible now, which matters the very first time: this iframe loads
      // (and fits itself to Czechia) as soon as the app boots, while Mapa
      // is still hidden behind Domů and its container is 0x0, so that
      // first fit computes a bogus all-the-way-zoomed-out view. See the
      // didInitialFit comment in leafletHtml.ts.
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "refreshView" }), "*");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mapReady]);

  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="celá ČR · dnes"
        title="Mapa"
        subtitle="Hustota mraku = pravděpodobnost. Klepni na mapu pro detail místa."
        right={
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Jak funguje mapa"
            >
              <Info size={ts(20)} strokeWidth={1.8} color={palette.inkFaint} />
            </Pressable>
            <CurrentLocationPill />
          </View>
        }
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
            onPress={() => {
              if (isPremium) setMode({ type: "species", id: sp.id });
              else if (!subscriptionLoading) openPaywall("Chcete vidět mapu podle konkrétní houby?");
            }}
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
            <LoadingProgress percent={gridProgress} />
          </View>
        )}
      </View>
      {selected && <LocationSheet selected={selected} mode={mode} onClose={() => setSelected(null)} />}
      {infoOpen && <MapInfoSheet onClose={() => setInfoOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: space.sm },
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
