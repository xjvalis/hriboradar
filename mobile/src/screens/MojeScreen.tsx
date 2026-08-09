import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Bell, BellOff, ClipboardCheck, Sprout, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { EmptyState } from "../components/EmptyState";
import { LocationSearchInput } from "../components/LocationSearchInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { ObservationSheet } from "../components/ObservationSheet";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { useLocation } from "../LocationContext";

function placesLabel(n: number): string {
  if (n === 1) return "1 uložené místo";
  if (n >= 2 && n <= 4) return `${n} uložená místa`;
  return `${n} uložených míst`;
}

export default function MojeScreen() {
  const { locations, addLocation, removeLocation, toggleLocationAlerts } = useSavedLocations();
  const { setLocation } = useLocation();
  const [observing, setObserving] = useState<SavedLocation | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLabel, setManualLabel] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  function addManual() {
    const lat = parseFloat(manualLat.replace(",", "."));
    const lon = parseFloat(manualLon.replace(",", "."));
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    addLocation({ lat, lon, label: manualLabel.trim() || "Vlastní místo" });
    setManualLabel("");
    setManualLat("");
    setManualLon("");
    setManualOpen(false);
  }

  return (
    <ScrollView style={styles.screen}>
      <PaperBackground style={styles.content}>
      <PageHeader
        eyebrow="chalupa, revír, les"
        title="Moje"
        subtitle={placesLabel(locations.length)}
      />

      <Text style={styles.sectionTitle}>Přidat místo</Text>
      <View style={styles.padded}>
        <LocationSearchInput onSelect={addLocation} />
        <Pressable onPress={() => setManualOpen((v) => !v)} hitSlop={6} style={styles.manualToggle}>
          <Text style={styles.manualToggleText}>
            {manualOpen ? "Skrýt ruční zadání" : "+ Zadat souřadnice ručně (chalupa, oblíbený lesík…)"}
          </Text>
        </Pressable>
        {manualOpen && (
          <View style={styles.manualForm}>
            <TextInput
              style={styles.input}
              value={manualLabel}
              onChangeText={setManualLabel}
              placeholder="Název místa (např. Chalupa)"
              placeholderTextColor={palette.inkFaint}
            />
            <View style={styles.manualRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={manualLat}
                onChangeText={setManualLat}
                placeholder="Zeměpisná šířka"
                placeholderTextColor={palette.inkFaint}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={manualLon}
                onChangeText={setManualLon}
                placeholder="Zeměpisná délka"
                placeholderTextColor={palette.inkFaint}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <PrimaryButton label="Přidat místo" onPress={addManual} />
          </View>
        )}
      </View>

      {locations.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Zatím tu nic neroste"
          description="Zatím nemáte žádná uložená místa. Přidejte si chalupu, oblíbený lesík nebo mez u babičky a budeme hlídat, kdy se tam vyplatí vyrazit s košíkem."
        />
      ) : (
        <View style={[styles.padded, styles.list]}>
          {locations.map((loc) => {
            const alertsOn = loc.alertsEnabled !== false;
            return (
              <View key={loc.id} style={styles.card}>
                <Pressable style={{ flex: 1 }} onPress={() => setLocation(loc)}>
                  <Text style={styles.cardLabel}>{loc.label}</Text>
                  <Text style={styles.cardCoords}>
                    {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => toggleLocationAlerts(loc.id)} hitSlop={8} style={styles.deleteBtn}>
                  {alertsOn ? (
                    <Bell size={17} strokeWidth={1.8} color={palette.primary} />
                  ) : (
                    <BellOff size={17} strokeWidth={1.8} color={palette.inkFaint} />
                  )}
                </Pressable>
                <Pressable onPress={() => setObserving(loc)} hitSlop={8} style={styles.deleteBtn}>
                  <ClipboardCheck size={17} strokeWidth={1.8} color={palette.secondary} />
                </Pressable>
                <Pressable onPress={() => removeLocation(loc.id)} hitSlop={8} style={styles.deleteBtn}>
                  <Trash2 size={17} strokeWidth={1.8} color={palette.inkFaint} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.note}>
        Klepnutím na místo ho nastavíte jako aktuální - Domů a Mapa se přepnou na něj. Zvoneček
        zapne/vypne upozornění pro dané místo (i na houby, které tam mají začít růst až v příštích dnech).
        Ikonka se zaškrtnutím zapíše, jestli tam houby fakt rostly - pomáhá to zpřesňovat model.
      </Text>

      {observing && <ObservationSheet location={observing} onClose={() => setObserving(null)} />}
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space.xxl },
  padded: { paddingHorizontal: space.lg },
  sectionTitle: {
    ...type.label,
    color: palette.inkSoft,
    marginTop: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  list: { gap: space.sm, marginTop: space.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardLabel: { ...type.headingSm, color: palette.ink },
  cardCoords: { ...type.caption, color: palette.inkFaint, marginTop: 2 },
  deleteBtn: { padding: space.xs },
  note: { ...type.caption, color: palette.inkFaint, marginTop: space.xl, paddingHorizontal: space.lg, lineHeight: 16 },
  manualToggle: { marginTop: space.sm, alignSelf: "flex-start" },
  manualToggleText: { ...type.bodySmall, color: palette.primary },
  manualForm: { gap: space.sm, marginTop: space.md },
  manualRow: { flexDirection: "row", gap: space.sm },
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
