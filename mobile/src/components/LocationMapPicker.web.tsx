import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { useLocation } from "../LocationContext";
import { buildPinPickerHtml } from "../leafletHtml";
import { BottomSheet } from "./BottomSheet";
import { LocationSearchInput } from "./LocationSearchInput";
import { PrimaryButton } from "./PrimaryButton";
import type { AppLocation } from "../LocationContext";

// react-native-webview has no web implementation (renders a "does not
// support this platform" placeholder there) - same reason MapScreen needed
// a .web.tsx split. This mirrors that: build the same pin-picker HTML
// client-side and drop it in a plain iframe instead of fetching it through
// a WebView.
export function LocationMapPicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (location: AppLocation) => void;
  onClose: () => void;
}) {
  const { location: appLocation } = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pin, setPin] = useState({ lat: appLocation.lat, lon: appLocation.lon });
  const [label, setLabel] = useState("");

  const html = useMemo(
    () =>
      buildPinPickerHtml({
        lat: appLocation.lat,
        lon: appLocation.lon,
        zoom: 12,
        mapApiKey: process.env.EXPO_PUBLIC_MAPY_CZ_API_KEY ?? "",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "pinMoved") setPin({ lat: msg.lat, lon: msg.lon });
      } catch {
        // not our message
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function recenter(lat: number, lon: number) {
    setPin({ lat, lon });
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "recenter", lat, lon, zoom: 15 }), "*");
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
          <iframe ref={iframeRef} title="Vybrat místo" srcDoc={html} style={{ width: "100%", height: "100%", border: 0 }} />
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
    marginTop: space.xs,
  },
  coords: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: palette.ink,
  },
});
