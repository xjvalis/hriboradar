import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Dog } from "lucide-react-native";
import { palette, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Chip } from "./Chip";
import { PrimaryButton } from "./PrimaryButton";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { SPECIES_BY_ID } from "../speciesInfo";
import { registerForPushNotificationsAsync } from "../pushNotifications";

const ALL_SPECIES = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));
const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90];

// Houbařský pes - hlídá jedno konkrétní uložené místo a upozorní, jakmile
// šance na vybranou houbu (nebo na kteroukoli, viz "Kterýkoli druh")
// poprvé přeleze zvolenou hranici (api/cron/watchdog.ts). Push notifikace
// je hlavní kanál - žádost o oprávnění se posílá schválně až tady, ne při
// startu appky, protože až teď má uživatel reálný důvod říct "ano, chci
// vědět" - vyskočit s tím dřív by četlo jako otravné vyskakovací okno bez
// kontextu. E-mail chodí navíc pokaždé, ne jen jako fallback.
export function WatchdogSheet({ location, onClose }: { location: SavedLocation; onClose: () => void }) {
  const { setWatchdog } = useSavedLocations();
  const [speciesId, setSpeciesId] = useState<string | null>(location.watchdogSpeciesId);
  const [threshold, setThreshold] = useState<number>(location.watchdogThresholdPct ?? 70);
  const [saving, setSaving] = useState(false);
  const isActive = location.watchdogThresholdPct != null;

  async function save() {
    setSaving(true);
    await registerForPushNotificationsAsync();
    setWatchdog(location.id, speciesId, threshold);
    setSaving(false);
    onClose();
  }

  function turnOff() {
    setWatchdog(location.id, null, null);
    onClose();
  }

  return (
    <BottomSheet onClose={onClose} maxHeight="85%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Dog size={22} strokeWidth={2} color={palette.primary} />
          <Text style={styles.title}>Houbařský pes - {location.label}</Text>
        </View>
        <Text style={styles.hint}>
          Ozveme se push notifikací (appka o ni požádá po uložení) a zároveň e-mailem, jakmile šance
          na místě poprvé přeleze tuhle hranici - ne pokaždé, co zůstane vysoká, jen při prvním
          překročení. Kontrolujeme jednou denně ráno.
        </Text>

        <Text style={styles.sectionLabel}>Hlídat</Text>
        <View style={styles.chipRow}>
          <Chip label="Kterýkoli druh" active={speciesId === null} onPress={() => setSpeciesId(null)} />
          {ALL_SPECIES.map((sp) => (
            <Chip key={sp.id} label={sp.name_cz} active={speciesId === sp.id} onPress={() => setSpeciesId(sp.id)} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Od jaké šance</Text>
        <View style={styles.chipRow}>
          {THRESHOLD_OPTIONS.map((pct) => (
            <Chip key={pct} label={`${pct} %`} active={threshold === pct} onPress={() => setThreshold(pct)} />
          ))}
        </View>

        <PrimaryButton label={isActive ? "Uložit změny" : "Zapnout hlídání"} onPress={save} loading={saving} />
        {isActive && (
          <Text onPress={turnOff} style={styles.turnOff}>
            Vypnout hlídání
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  title: { ...type.headingLg, color: palette.ink, flexShrink: 1 },
  hint: { ...type.bodySmall, color: palette.inkSoft, marginTop: space.xs, marginBottom: space.lg, lineHeight: 19 },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginBottom: space.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
  turnOff: { ...type.bodySmall, color: palette.danger, textAlign: "center", marginTop: space.md },
});
