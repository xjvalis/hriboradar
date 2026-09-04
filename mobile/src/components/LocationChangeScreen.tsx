import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { X, HelpCircle, LocateFixed, MapPin, Info } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette, radius, space, ts, type } from "../theme";
import { API_BASE, reverseGeocode } from "../api";
import { useLocation, PRESET_LOCATIONS, type AppLocation } from "../LocationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { useLocationPicker } from "../LocationPickerContext";
import { LocationSearchInput } from "./LocationSearchInput";
import { PrimaryButton } from "./PrimaryButton";
import { LocationGuideOverlay } from "./LocationGuideOverlay";

// expo-location has native code - see LocationPickerBody's original
// comment on why this needs a guarded require() rather than a static
// import (a native module not linked yet would crash on evaluation).
let ExpoLocation: typeof import("expo-location") | null;
try {
  ExpoLocation = require("expo-location");
} catch {
  ExpoLocation = null;
}

const GUIDE_SEEN_KEY = "hriboradar:locationGuideSeen";

// Replaces the old small "change location" bottom sheet with a full screen
// built around the map+pin picker that used to be MojeScreen-only - a real
// user's default GPS position was often a built-up area with nothing
// useful to forecast, and the old sheet's search box led to the exact same
// problem (a geocoded address is still just a building). Search now only
// gets you *close*; dragging the pin onto real forest is the deliberate
// second step, with a first-time guide explaining why that step matters
// (found 2026-09-04 watching a first real user fight this by hand).
export function LocationChangeScreen() {
  const { isOpen, closePicker } = useLocationPicker();
  const { location: appLocation, setLocation, useGpsLocation } = useLocation();
  const { locations: saved } = useSavedLocations();
  const webviewRef = useRef<WebView>(null);
  const [pin, setPin] = useState({ lat: appLocation.lat, lon: appLocation.lon });
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // Built fresh each time the screen opens (from wherever the app was
  // pointed at that moment), not on every pin drag - moving the pin pushes
  // into the already-loaded page via postMessage instead, same pattern as
  // MojeScreen's picker, so panning/zoom the user just set up doesn't reset
  // every time they nudge the pin.
  const pickerUri = useMemo(
    () => `${API_BASE}/api/map-pin?lat=${appLocation.lat}&lon=${appLocation.lon}&zoom=12`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  useEffect(() => {
    if (!isOpen) return;
    setPin({ lat: appLocation.lat, lon: appLocation.lon });
    setLocateError(null);
    setWebviewError(null);
    AsyncStorage.getItem(GUIDE_SEEN_KEY)
      .then((seen) => setGuideOpen(!seen))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function recenter(lat: number, lon: number) {
    setPin({ lat, lon });
    webviewRef.current?.postMessage(JSON.stringify({ type: "recenter", lat, lon, zoom: 15 }));
  }

  function save() {
    setLocation({ lat: pin.lat, lon: pin.lon, label: "Vlastní bod" });
    closePicker();
  }

  function pick(loc: AppLocation) {
    setLocation(loc);
    closePicker();
  }

  async function useCurrentLocation() {
    setLocateError(null);
    if (!ExpoLocation) {
      setLocateError("Aktuální poloha bude dostupná po další aktualizaci appky.");
      return;
    }
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocateError("Přístup k poloze je zakázaný - povolte ho telefonu v nastavení.");
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const geocoded = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      useGpsLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        label: geocoded?.label ?? "Aktuální poloha",
      });
      closePicker();
    } catch {
      setLocateError("Polohu se nepodařilo zjistit.");
    } finally {
      setLocating(false);
    }
  }

  function closeGuide() {
    setGuideOpen(false);
    AsyncStorage.setItem(GUIDE_SEEN_KEY, "true").catch(() => {});
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={closePicker} hitSlop={8} style={styles.headerBtn}>
            <X size={ts(20)} strokeWidth={2} color={palette.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Vybrat polohu</Text>
          <Pressable onPress={() => setGuideOpen(true)} hitSlop={8} style={styles.headerBtn}>
            <HelpCircle size={ts(20)} strokeWidth={2} color={palette.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={useCurrentLocation} disabled={locating} style={styles.gpsRow}>
            {locating ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <LocateFixed size={ts(18)} strokeWidth={1.8} color={palette.primary} />
            )}
            <Text style={styles.gpsRowText}>{locating ? "Zjišťuji polohu…" : "Použít aktuální polohu (GPS)"}</Text>
          </Pressable>
          {locateError && <Text style={styles.locateError}>{locateError}</Text>}

          <Text style={styles.orDivider}>nebo si vyberte místo na mapě</Text>

          <LocationSearchInput onSelect={(r) => recenter(r.lat, r.lon)} />

          <View style={styles.hintBox}>
            <Info size={ts(14)} strokeWidth={2} color={palette.accent} />
            <Text style={styles.hintText}>
              Vyberte nezastavěné místo - kraj lesa nebo remízek u pole, ne přímo dům ve vesnici.
            </Text>
          </View>

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
          <Text style={styles.coords}>
            {pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}
          </Text>

          <PrimaryButton label="Uložit a použít" onPress={save} />

          {saved.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Moje uložená místa</Text>
              <View style={{ gap: space.xs }}>
                {saved.map((loc) => (
                  <Pressable key={loc.id} onPress={() => pick(loc)} style={styles.row}>
                    <MapPin size={ts(16)} strokeWidth={1.8} color={palette.inkFaint} />
                    <Text style={styles.rowText}>{loc.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Rychlá volba</Text>
          <View style={styles.presetRow}>
            {PRESET_LOCATIONS.map((preset) => (
              <Pressable key={preset.label} onPress={() => pick(preset)} style={styles.preset}>
                <Text style={styles.presetText}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {guideOpen && <LocationGuideOverlay onClose={closeGuide} />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headerBtn: { padding: space.xs },
  headerTitle: { ...type.headingMd, color: palette.ink },
  content: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.sm },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.primary + "14",
  },
  gpsRowText: { ...type.headingSm, color: palette.primary },
  locateError: { ...type.caption, color: palette.danger },
  orDivider: { ...type.caption, color: palette.inkFaint, textAlign: "center", marginTop: space.xs },
  hintBox: {
    flexDirection: "row",
    gap: space.xs,
    alignItems: "flex-start",
    backgroundColor: palette.accent + "14",
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.xs,
  },
  hintText: { ...type.bodySmall, color: palette.inkSoft, flex: 1 },
  mapCard: {
    height: 340,
    borderWidth: 1,
    borderColor: palette.line,
    marginTop: space.xs,
  },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
  },
  loading: { ...type.bodySmall, color: palette.inkFaint },
  error: { ...type.bodySmall, color: palette.danger, textAlign: "center", paddingHorizontal: space.lg },
  coords: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.lg, marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  rowText: { ...type.body, color: palette.inkSoft },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  preset: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: palette.surface,
  },
  presetText: { ...type.bodySmall, color: palette.inkSoft },
});
