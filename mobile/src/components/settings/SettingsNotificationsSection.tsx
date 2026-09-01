import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, ChevronDown, ChevronUp, Dog } from "lucide-react-native";
import { palette, radius, space, type } from "../../theme";
import { Chip } from "../Chip";
import { LocationAlertsSheet } from "../LocationAlertsSheet";
import { useNotifications } from "../../NotificationContext";
import { useNotificationPrefs } from "../../NotificationPrefsContext";
import { useSavedLocations, type SavedLocation } from "../../SavedLocationsContext";
import { useSubscription } from "../../SubscriptionContext";
import { usePaywall } from "../../PaywallContext";
import { SPECIES_BY_ID } from "../../speciesInfo";

const ALL_SPECIES = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));

export function SettingsNotificationsSection() {
  const { watchedSpecies, toggleWatchedSpecies } = useNotifications();
  const { monthlyTipsEnabled, setMonthlyTipsEnabled, terrainSuggestionsEnabled, setTerrainSuggestionsEnabled } =
    useNotificationPrefs();
  const { locations: savedLocations } = useSavedLocations();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const [alertsFor, setAlertsFor] = useState<SavedLocation | null>(null);
  const [speciesExpanded, setSpeciesExpanded] = useState(false);

  function handleToggleSpecies(id: string) {
    if (!isPremium) {
      openPaywall("Chcete sledovat konkrétní houby a dostávat upozornění na jejich sezónu?");
      return;
    }
    toggleWatchedSpecies(id);
  }

  return (
    <View style={styles.padded}>
      <Text style={styles.intro}>
        Tři nezávislé zdroje upozornění - obecné tipy pro každého, přesně nastavené hlídání konkrétních
        míst a sledování jednotlivých druhů. Klidně zapněte jen to, co se hodí.
      </Text>

      <Text style={styles.groupTitle}>Obecné tipy</Text>
      <Text style={styles.groupHint}>Neváže se na konkrétní místo ani druh - jen občasné připomenutí.</Text>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Měsíční tip</Text>
          <Text style={styles.toggleHint}>Jednou za měsíc krátký houbařský tip, co má zrovna sezónu.</Text>
        </View>
        <Switch
          value={monthlyTipsEnabled}
          onValueChange={setMonthlyTipsEnabled}
          trackColor={{ false: palette.line, true: palette.primary }}
          thumbColor={palette.white}
        />
      </View>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Tipy na sledování</Text>
          <Text style={styles.toggleHint}>
            Když je u uloženého místa hodně stromů, kterým sedí nějaká nesledovaná houba, navrhneme ji přidat.
          </Text>
        </View>
        <Switch
          value={terrainSuggestionsEnabled}
          onValueChange={setTerrainSuggestionsEnabled}
          trackColor={{ false: palette.line, true: palette.primary }}
          thumbColor={palette.white}
        />
      </View>

      <Text style={styles.groupTitle}>Hlídaná místa</Text>
      <Text style={styles.groupHint}>
        Per-místo nastavení - obecné upozornění na dobré podmínky, a houbařský pes (Plus), který se
        ozve push notifikací a e-mailem, jakmile šance na vybranou houbu poprvé přeleze vaši hranici.
        Kontrolujeme jednou denně ráno.
      </Text>
      {savedLocations.length > 0 ? (
        <View style={styles.watchList}>
          {savedLocations.map((loc) => {
            const alertsOn = loc.alertsEnabled !== false;
            const watchdogOn = loc.watchdogThresholdPct != null;
            const watchdogSpeciesName = loc.watchdogSpeciesId ? SPECIES_BY_ID[loc.watchdogSpeciesId]?.name_cz : null;
            return (
              <Pressable
                key={loc.id}
                style={styles.watchRow}
                onPress={() => setAlertsFor(loc)}
                accessibilityRole="button"
                accessibilityLabel={`Upravit upozornění pro ${loc.label}`}
              >
                <Text style={styles.watchRowLabel} numberOfLines={1}>
                  {loc.label}
                </Text>
                <View style={styles.watchRowBadges}>
                  {alertsOn && <Bell size={13} strokeWidth={1.8} color={palette.primary} />}
                  {watchdogOn && (
                    <View style={styles.watchdogBadge}>
                      <Dog size={13} strokeWidth={1.8} color={palette.primaryDeep} />
                      <Text style={styles.watchdogBadgeText}>
                        {watchdogSpeciesName ?? "kterýkoli"} {loc.watchdogThresholdPct}%+
                      </Text>
                    </View>
                  )}
                  {!alertsOn && !watchdogOn && <Text style={styles.watchRowOff}>Vypnuto</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyHint}>Zatím nemáte žádná uložená místa - přidejte je v sekci Moje.</Text>
      )}

      <Text style={styles.groupTitle}>Sledované druhy</Text>
      <Text style={styles.groupHint}>
        Upozorníme, když sledovanému druhu začíná nebo vrcholí sezóna, bez ohledu na místo. Jde zapnout
        i přímo v detailu houby v Atlasu.
      </Text>
      <Pressable
        style={styles.speciesToggle}
        onPress={() => setSpeciesExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={speciesExpanded ? "Skrýt seznam druhů" : "Zobrazit seznam druhů"}
      >
        <Text style={styles.speciesToggleLabel}>
          {watchedSpecies.length > 0 ? `${watchedSpecies.length} sledovaných druhů` : "Žádný druh zatím nesledujete"}
        </Text>
        {speciesExpanded ? (
          <ChevronUp size={16} strokeWidth={1.8} color={palette.inkFaint} />
        ) : (
          <ChevronDown size={16} strokeWidth={1.8} color={palette.inkFaint} />
        )}
      </Pressable>
      {speciesExpanded && (
        <View style={styles.presetRow}>
          {ALL_SPECIES.map((sp) => (
            <Chip
              key={sp.id}
              label={sp.name_cz}
              active={watchedSpecies.includes(sp.id)}
              onPress={() => handleToggleSpecies(sp.id)}
            />
          ))}
        </View>
      )}

      {alertsFor && <LocationAlertsSheet location={alertsFor} onClose={() => setAlertsFor(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.lg },
  intro: { ...type.bodySmall, color: palette.inkSoft, lineHeight: 19, marginBottom: space.lg },
  groupTitle: { ...type.headingSm, color: palette.ink, marginTop: space.xl, marginBottom: 4 },
  groupHint: { ...type.caption, color: palette.inkFaint, lineHeight: 15, marginBottom: space.sm },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  toggleLabel: { ...type.headingSm, color: palette.ink },
  toggleHint: { ...type.caption, color: palette.inkFaint, marginTop: 2, lineHeight: 15 },
  watchList: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  watchRowLabel: { ...type.bodySmall, color: palette.ink, flexShrink: 1 },
  watchRowBadges: { flexDirection: "row", alignItems: "center", gap: space.sm },
  watchRowOff: { ...type.caption, color: palette.inkFaint },
  watchdogBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: palette.primary + "14",
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  watchdogBadgeText: { ...type.caption, color: palette.primaryDeep },
  emptyHint: { ...type.bodySmall, color: palette.inkFaint, fontStyle: "italic" },
  speciesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  speciesToggleLabel: { ...type.headingSm, color: palette.ink },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
});
