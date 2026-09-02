import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, Dog } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Chip } from "./Chip";
import { PrimaryButton } from "./PrimaryButton";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { SPECIES_BY_ID } from "../speciesInfo";
import { registerForPushNotificationsAsync } from "../pushNotifications";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";

const ALL_SPECIES = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));
const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90];

// One sheet for everything a saved location's alerts can do - reachable
// both from the dog icon on its card in Moje and from a row tap on
// Nastavení's "Hlídaná místa" list, so there's exactly one place to
// actually configure this stuff, not a fast icon-toggle in one screen and
// a dead-end summary in the other. Used to be watchdog-only (a separate,
// harder-to-find sheet); merged with the general alerts toggle - which
// used to live as an instant icon-flip with no way to review/undo except
// re-tapping blind - on explicit request: both should be "standardně
// rozkliknutelné a kvalitně nastavitelné" from the same place.
export function LocationAlertsSheet({ location, onClose }: { location: SavedLocation; onClose: () => void }) {
  const { toggleLocationAlerts, setWatchdog } = useSavedLocations();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { openPaywall } = usePaywall();
  const [alertsOn, setAlertsOn] = useState(location.alertsEnabled !== false);
  const [watchdogOn, setWatchdogOn] = useState(location.watchdogThresholdPct != null);
  const [speciesId, setSpeciesId] = useState<string | null>(location.watchdogSpeciesId);
  const [threshold, setThreshold] = useState<number>(location.watchdogThresholdPct ?? 70);
  const [saving, setSaving] = useState(false);

  // General alerts stay free; houbařský pes is Plus-only - gated right at
  // the switch (not by blocking the whole sheet from opening) so a free
  // account can still open this to review/adjust general alerts without
  // hitting a paywall for something that was never gated to begin with.
  function handleWatchdogToggle(next: boolean) {
    // subscriptionLoading: see SubscriptionContext.tsx - don't paywall a
    // real Plus subscriber for the length of one RevenueCat round-trip.
    if (next && subscriptionLoading) return;
    if (next && !isPremium) {
      openPaywall("Chcete, ať vás houbařský pes upozorní, až šance na tomhle místě vyroste?");
      return;
    }
    setWatchdogOn(next);
  }

  async function save() {
    setSaving(true);
    if ((location.alertsEnabled !== false) !== alertsOn) toggleLocationAlerts(location.id);
    if (watchdogOn) {
      await registerForPushNotificationsAsync();
      setWatchdog(location.id, speciesId, threshold);
    } else if (location.watchdogThresholdPct != null) {
      setWatchdog(location.id, null, null);
    }
    setSaving(false);
    onClose();
  }

  return (
    <BottomSheet onClose={onClose} maxHeight="90%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{location.label}</Text>

        <View style={styles.toggleRow}>
          <Bell size={ts(19)} strokeWidth={1.8} color={palette.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Obecná upozornění</Text>
            <Text style={styles.toggleHint}>
              Dnešní nebo blížící se dobré podmínky na tomhle místě - i na houby, co tam mají začít
              růst až v příštích dnech.
            </Text>
          </View>
          <Switch
            value={alertsOn}
            onValueChange={setAlertsOn}
            trackColor={{ false: palette.line, true: palette.primary }}
            thumbColor={palette.white}
          />
        </View>

        <View style={styles.toggleRow}>
          <Dog size={ts(19)} strokeWidth={1.8} color={palette.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Houbařský pes</Text>
            <Text style={styles.toggleHint}>
              Push notifikace a e-mail, jakmile šance na vybranou houbu poprvé přeleze zvolenou
              hranici. Kontrolujeme jednou denně ráno.
            </Text>
          </View>
          <Switch
            value={watchdogOn}
            onValueChange={handleWatchdogToggle}
            trackColor={{ false: palette.line, true: palette.primary }}
            thumbColor={palette.white}
          />
        </View>

        {watchdogOn && (
          <View style={styles.watchdogDetail}>
            <Text style={styles.sectionLabel}>Hlídat</Text>
            <View style={styles.chipRow}>
              <Chip label="Kterýkoli druh" active={speciesId === null} onPress={() => setSpeciesId(null)} />
              {ALL_SPECIES.map((sp) => (
                <Chip
                  key={sp.id}
                  label={sp.name_cz}
                  active={speciesId === sp.id}
                  onPress={() => setSpeciesId(sp.id)}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Od jaké šance</Text>
            <View style={styles.chipRow}>
              {THRESHOLD_OPTIONS.map((pct) => (
                <Chip key={pct} label={`${pct} %`} active={threshold === pct} onPress={() => setThreshold(pct)} />
              ))}
            </View>
          </View>
        )}

        <PrimaryButton label="Uložit" onPress={save} loading={saving} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.md },
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
  watchdogDetail: { marginBottom: space.sm },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginBottom: space.sm, marginTop: space.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
});
