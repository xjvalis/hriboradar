import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { palette, radius, space, type } from "../theme";
import { getGrid, API_BASE, type GridResponse } from "../api";
import { useLocation } from "../LocationContext";
import { type MapMode } from "../leafletHtml";
import { PageHeader } from "../components/PageHeader";
import { Chip } from "../components/Chip";
import { LocationSheet, type SelectedLocation } from "../components/LocationSheet";

export default function MapScreen() {
  const { location } = useLocation();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>({ type: "overall" });
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const webviewRef = useRef<WebView>(null);
  const isFirstMode = useRef(true);

  useEffect(() => {
    console.log("[MapScreen] Mounting, API_BASE =", API_BASE);
    getGrid()
      .then((g) => {
        console.log("[MapScreen] Grid loaded:", g.points.length, "points,", g.speciesList.length, "species");
        setGrid(g);
      })
      .catch((e) => {
        console.error("[MapScreen] Grid fetch error:", e);
        setGridError(String(e.message ?? e));
      });
  }, []);

  const mapUri = useMemo(
    () => {
      const uri = `${API_BASE}/api/map?lat=${location.lat}&lon=${location.lon}`;
      console.log("[MapScreen] mapUri updated:", uri);
      return uri;
    },
    [location.lat, location.lon]
  );

  useEffect(() => {
    if (isFirstMode.current) {
      isFirstMode.current = false;
      return;
    }
    webviewRef.current?.postMessage(JSON.stringify({ type: "setMode", mode }));
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
        {gridError || webviewError ? (
          <Text style={styles.error}>
            Mapu se nepodařilo načíst: {gridError ?? webviewError}
            {"\n"}Je telefon na stejné Wi-Fi jako server?
          </Text>
        ) : !grid ? (
          <Text style={styles.loading}>Načítám data z API…</Text>
        ) : (
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ uri: mapUri }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <Text style={styles.loading}>Počítám mřížku pro celou republiku…</Text>
              </View>
            )}
            onLoadStart={() => console.log("[Mapa WebView] loadStart", mapUri)}
            onLoadEnd={(e) => console.log("[Mapa WebView] loadEnd", JSON.stringify(e.nativeEvent))}
            onLoadProgress={(e) => console.log("[Mapa WebView] loadProgress", e.nativeEvent.progress)}
            onError={(e) => {
              console.log("[Mapa WebView] onError", JSON.stringify(e.nativeEvent));
              setWebviewError(e.nativeEvent.description);
            }}
            onHttpError={(e) => {
              console.log("[Mapa WebView] onHttpError", JSON.stringify(e.nativeEvent));
              setWebviewError(`HTTP ${e.nativeEvent.statusCode}`);
            }}
            onMessage={(e) => {
              console.log("[Mapa WebView] onMessage raw:", e.nativeEvent.data);
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === "locationSelected") setSelected(msg);
                else if (msg.type === "jsError") {
                  console.error("[Mapa WebView] JS error:", msg.message);
                  setWebviewError(`Chyba na stránce mapy: ${msg.message}`);
                } else if (msg.type === "tileError") {
                  console.error("[Mapa WebView] Tile error");
                  setWebviewError("Nepodařilo se stáhnout mapové dlaždice - má telefon přístup k internetu?");
                } else if (msg.type === "ready") {
                  console.log("[Mapa WebView] Page ready!");
                }
              } catch {
                // not our message
              }
            }}
          />
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
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
  },
  error: { ...type.bodySmall, color: palette.danger, textAlign: "center", paddingHorizontal: space.lg },
});
