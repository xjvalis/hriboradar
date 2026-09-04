import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { palette, radius, space, ts, type } from "../theme";
import { API_BASE } from "../api";
import { useLocation } from "../LocationContext";
import { BottomSheet } from "./BottomSheet";
import { LocationSearchInput } from "./LocationSearchInput";
import { PrimaryButton } from "./PrimaryButton";
import type { AppLocation } from "../LocationContext";

// Replaces raw lat/lon text fields for "add a place that isn't findable by
// name" (e.g. a chalupa in the middle of a forest) - search moves the pin
// close, then drag/tap fine-tunes it, so the saved spot is something you can
// actually see and confirm instead of two numbers typed on faith. The pin
// page (api/map-pin.ts) loads once; both search and drag update it in place
// via postMessage rather than reloading the WebView.
export function LocationMapPicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (location: AppLocation) => void;
  onClose: () => void;
}) {
  const { location: appLocation } = useLocation();
  const webviewRef = useRef<WebView>(null);
  const [pin, setPin] = useState({ lat: appLocation.lat, lon: appLocation.lon });
  const [label, setLabel] = useState("");
  const [webviewError, setWebviewError] = useState<string | null>(null);

  // Built once, from the starting location only - moving the pin afterwards
  // (search or drag) is pushed into the already-loaded page, same pattern as
  // MapScreen's species-mode switch, so panning/zoom the user just set up
  // doesn't get reset every time they nudge the pin.
  const pickerUri = useMemo(
    () => `${API_BASE}/api/map-pin?lat=${appLocation.lat}&lon=${appLocation.lon}&zoom=12`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function recenter(lat: number, lon: number) {
    setPin({ lat, lon });
    webviewRef.current?.postMessage(JSON.stringify({ type: "recenter", lat, lon, zoom: 15 }));
  }

  function confirm() {
    onConfirm({ lat: pin.lat, lon: pin.lon, label: label.trim() || "Vlastní místo" });
  }

  return (
    <BottomSheet onClose={onClose} maxHeight="90%">
      <View style={styles.content}>
        <Text style={styles.title}>Najít na mapě</Text>
        <Text style={styles.subtitle}>Vyhledejte místo poblíž a špendlík přesuňte tažením přesně na svoje místo.</Text>

        <LocationSearchInput onSelect={(r) => recenter(r.lat, r.lon)} />

        <View style={styles.mapCard}>
          {webviewError ? (
            <View style={styles.centerOverlay}>
              <Text style={styles.error}>
                Mapu se nepodařilo načíst: {webviewError}
                {"\n"}Je telefon na stejné Wi-Fi jako server?
              </Text>
            </View>
          ) : (
            <WebView
              ref={webviewRef}
              originWhitelist={["*"]}
              source={{ uri: pickerUri }}
              // See MapScreen.tsx - borderRadius/overflow belong on the
              // WebView itself, not a wrapping View with overflow:hidden,
              // or the WebView's native layer can fail to render at all.
              // mapCard no longer centers its children (see centerOverlay),
              // so this WebView gets RN's default cross-axis stretch.
              style={{ flex: 1, borderRadius: radius.md, overflow: "hidden" }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingWrap}>
                  <Text style={styles.loading}>Načítám mapu…</Text>
                </View>
              )}
              onError={(e) => setWebviewError(e.nativeEvent.description)}
              onHttpError={(e) => setWebviewError(`HTTP ${e.nativeEvent.statusCode}`)}
              onMessage={(e) => {
                try {
                  const msg = JSON.parse(e.nativeEvent.data);
                  if (msg.type === "pinMoved") setPin({ lat: msg.lat, lon: msg.lon });
                } catch {
                  // not our message
                }
              }}
            />
          )}
        </View>

        <Text style={styles.coords}>{pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}</Text>

        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Název místa (např. Chalupa)"
          placeholderTextColor={palette.inkFaint}
        />

        <PrimaryButton label="Přidat místo" onPress={confirm} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl, gap: space.sm },
  title: { ...type.headingLg, color: palette.ink },
  subtitle: { ...type.bodySmall, color: palette.inkSoft, marginBottom: space.xs },
  mapCard: {
    height: 280,
    borderWidth: 1,
    borderColor: palette.line,
    marginTop: space.xs,
  },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  loadingWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg },
  loading: { ...type.bodySmall, color: palette.inkFaint },
  error: { ...type.bodySmall, color: palette.danger, textAlign: "center", paddingHorizontal: space.lg },
  coords: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: ts(14),
    color: palette.ink,
  },
});
