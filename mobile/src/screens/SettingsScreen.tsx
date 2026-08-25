import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { Chip } from "../components/Chip";
import { useLocation } from "../LocationContext";
import { useLocationPicker } from "../LocationPickerContext";
import { useNotifications } from "../NotificationContext";
import { useAuth } from "../AuthContext";
import { SPECIES_BY_ID } from "../speciesInfo";

const ALL_SPECIES = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));

export default function SettingsScreen() {
  const { location } = useLocation();
  const { openPicker } = useLocationPicker();
  const { watchedSpecies, toggleWatchedSpecies } = useNotifications();
  const { user, signOut } = useAuth();

  return (
    <ScrollView style={styles.screen}>
      <PaperBackground style={styles.content}>
      <PageHeader eyebrow="appka počítá pro" title="Nastavení" />

      <Text style={styles.sectionTitle}>Aktuální poloha</Text>
      {/* Same search/presets/uložená místa picker used everywhere else
          (Domů, Předpověď, Mapa) - having a second, separately-typed-out
          version here previously meant its "Přesné souřadnice" fields
          could silently drift out of sync with the real location whenever
          it changed anywhere else in the app. */}
      <Pressable style={styles.currentCard} onPress={openPicker}>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentLabel}>{location.label}</Text>
          <Text style={styles.currentCoords}>
            {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </Text>
        </View>
        <ChevronRight size={18} strokeWidth={1.8} color={palette.inkFaint} />
      </Pressable>

      <Text style={styles.sectionTitle}>Upozornění</Text>
      <Text style={styles.hint}>
        Upozornění pro jednotlivá uložená místa se zapínají zvonečkem přímo v sekci Moje - tady jen
        vybíráte, které druhy chcete sledovat.
      </Text>
      <Text style={[styles.hint, { marginTop: space.md }]}>
        Sledované druhy - upozorníme, když jim začíná nebo vrcholí sezóna. Jde zapnout i přímo v detailu
        houby.
      </Text>
      <View style={styles.presetRow}>
        {ALL_SPECIES.map((sp) => (
          <Chip
            key={sp.id}
            label={sp.name_cz}
            active={watchedSpecies.includes(sp.id)}
            onPress={() => toggleWatchedSpecies(sp.id)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Účet</Text>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>{user?.email ?? "Přihlášeno"}</Text>
        <Text style={styles.signOutLink} onPress={signOut}>
          Odhlásit se
        </Text>
      </View>
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  sectionTitle: { ...type.label, color: palette.inkSoft, marginTop: space.xl, marginBottom: space.sm },
  hint: { ...type.caption, color: palette.inkFaint, marginTop: -4, marginBottom: space.sm },
  currentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
  },
  currentLabel: { ...type.headingSm, color: palette.ink },
  currentCoords: { ...type.bodySmall, color: palette.inkFaint, marginTop: 2 },
  signOutLink: { ...type.bodySmall, color: palette.danger, marginTop: space.sm },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
