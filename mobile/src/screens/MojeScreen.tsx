import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, BellOff, Dog, Map, MoreVertical, Sprout } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { EmptyState } from "../components/EmptyState";
import { LocationSearchInput } from "../components/LocationSearchInput";
import { LocationMapPicker } from "../components/LocationMapPicker";
import { ObservationSheet } from "../components/ObservationSheet";
import { NamePromptModal } from "../components/NamePromptModal";
import { LocationAlertsSheet } from "../components/LocationAlertsSheet";
import { LocationActionsSheet } from "../components/LocationActionsSheet";
import { ProbabilityBadge } from "../components/ProbabilityBadge";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { useLocation, type AppLocation } from "../LocationContext";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";
import { FREE_SAVED_LOCATIONS_LIMIT } from "../subscriptionLimits";
import { getForecast } from "../api";
import { computeDailyOverall } from "../forecastMath";

function placesLabel(n: number): string {
  if (n === 1) return "1 uložené místo";
  if (n >= 2 && n <= 4) return `${n} uložená místa`;
  return `${n} uložených míst`;
}

export default function MojeScreen() {
  const { locations, addLocation, removeLocation, toggleLocationAlerts, renameLocation } = useSavedLocations();
  const { setLocation } = useLocation();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { openPaywall } = usePaywall();
  const [observing, setObserving] = useState<SavedLocation | null>(null);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [renaming, setRenaming] = useState<SavedLocation | null>(null);
  const [alertsFor, setAlertsFor] = useState<SavedLocation | null>(null);
  const [actionsFor, setActionsFor] = useState<SavedLocation | null>(null);
  const [indexByLocation, setIndexByLocation] = useState<Record<string, number>>({});

  // Same houbový index every other screen shows (computeDailyOverall's
  // weighted-top-3 "overall", mirroring api/grid.ts) - lets someone with a
  // few saved spots see at a glance which one is actually worth a trip
  // today, without opening each one. Keyed on the id list (not `locations`
  // itself) so renaming/toggling alerts on an existing place doesn't
  // re-fetch every saved location's forecast on every unrelated edit.
  const locationIds = locations.map((l) => l.id).join(",");
  useEffect(() => {
    if (locations.length === 0) return;
    let cancelled = false;
    Promise.all(
      locations.map((loc) =>
        getForecast(loc.lat, loc.lon)
          .then((res) => {
            const overall = computeDailyOverall(res).find((d) => d.date === res.today)?.overall;
            return overall != null ? ([loc.id, overall] as const) : null;
          })
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setIndexByLocation(Object.fromEntries(results.filter((r): r is [string, number] => r != null)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationIds]);

  // Free tier: one saved place, enough to actually use the app (your own
  // backyard/nearest forest) - more than one is the "I go to several
  // specific spots" behavior that's worth paying for. Renaming/removing
  // an existing place is never gated, only *adding* a new one past the
  // limit.
  function addLocationGated(loc: AppLocation) {
    // subscriptionLoading: see SubscriptionContext.tsx - isPremium defaults
    // false until RevenueCat's customer info actually resolves, so gating
    // on it during that window would wrongly paywall a real Plus user's
    // 2nd+ saved location for the length of one network round-trip.
    if (!subscriptionLoading && !isPremium && locations.length >= FREE_SAVED_LOCATIONS_LIMIT) {
      openPaywall("Chcete uložit víc než jedno místo?");
      return;
    }
    addLocation(loc);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <PaperBackground style={styles.content}>
      <PageHeader
        eyebrow="chalupa, revír, les"
        title="Moje"
        subtitle={placesLabel(locations.length)}
      />

      <Text style={styles.sectionTitle}>Přidat místo</Text>
      <View style={styles.padded}>
        <LocationSearchInput onSelect={addLocationGated} />
        <Pressable
          onPress={() => setPickingOnMap(true)}
          style={styles.manualToggle}
          accessibilityRole="button"
          accessibilityLabel="Najít místo na mapě"
        >
          <Map size={16} strokeWidth={2} color={palette.primaryDeep} />
          <Text style={styles.manualToggleText} numberOfLines={1}>
            Najít na mapě
          </Text>
        </Pressable>
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
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setLocation(loc)}
                  accessibilityRole="button"
                  accessibilityLabel={`Nastavit ${loc.label} jako aktuální místo`}
                >
                  <Text style={styles.cardLabel}>{loc.label}</Text>
                  <Text style={styles.cardCoords}>
                    {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                  </Text>
                </Pressable>
                {indexByLocation[loc.id] != null && (
                  <ProbabilityBadge pct={indexByLocation[loc.id]} size="sm" style={{ alignSelf: "center" }} />
                )}
                <Pressable
                  onPress={() => toggleLocationAlerts(loc.id)}
                  hitSlop={6}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={alertsOn ? "Vypnout obecná upozornění na místo" : "Zapnout obecná upozornění na místo"}
                >
                  {alertsOn ? (
                    <Bell size={19} strokeWidth={1.8} color={palette.primary} />
                  ) : (
                    <BellOff size={19} strokeWidth={1.8} color={palette.inkFaint} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setAlertsFor(loc)}
                  hitSlop={6}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Upozornění na místo - obecné i houbařský pes"
                >
                  <Dog
                    size={19}
                    strokeWidth={1.8}
                    color={loc.watchdogThresholdPct != null ? palette.primary : palette.inkFaint}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setActionsFor(loc)}
                  hitSlop={6}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Další možnosti - zapsat pozorování, přejmenovat, smazat"
                >
                  <MoreVertical size={19} strokeWidth={1.8} color={palette.inkFaint} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.note}>
        Klepnutím na místo ho nastavíte jako aktuální - Domů a Mapa se přepnou na něj. Zvoneček
        rychle zapne/vypne obecná upozornění. Pejsek otevře podrobné nastavení upozornění pro tohle
        místo - obecná i houbařského psa. Přes "…" jde zapsat pozorování, přejmenovat nebo místo
        smazat.
      </Text>

      {observing && <ObservationSheet location={observing} onClose={() => setObserving(null)} />}
      {alertsFor && <LocationAlertsSheet location={alertsFor} onClose={() => setAlertsFor(null)} />}
      {actionsFor && (
        <LocationActionsSheet
          locationLabel={actionsFor.label}
          onObserve={() => setObserving(actionsFor)}
          onRename={() => setRenaming(actionsFor)}
          onDelete={() => removeLocation(actionsFor.id)}
          onClose={() => setActionsFor(null)}
        />
      )}
      {renaming && (
        <NamePromptModal
          title="Přejmenovat místo"
          initialValue={renaming.label}
          onCancel={() => setRenaming(null)}
          onConfirm={(label) => {
            renameLocation(renaming.id, label);
            setRenaming(null);
          }}
        />
      )}
      {pickingOnMap && (
        <LocationMapPicker
          onConfirm={(loc) => {
            addLocationGated(loc);
            setPickingOnMap(false);
          }}
          onClose={() => setPickingOnMap(false)}
        />
      )}
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
    gap: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardLabel: { ...type.headingSm, color: palette.ink },
  cardCoords: { ...type.caption, color: palette.inkFaint, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  note: { ...type.caption, color: palette.inkFaint, marginTop: space.xl, paddingHorizontal: space.lg, lineHeight: 16 },
  manualToggle: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    alignSelf: "stretch",
    backgroundColor: palette.primary + "14",
    borderWidth: 1,
    borderColor: palette.primary + "33",
    borderRadius: radius.md,
    // Explicit height matching LocationSearchInput's own explicit height
    // (see that component) - padding/line-height alone kept reading
    // taller in practice (2026-09-02 feedback, twice), so this pins both
    // to the same literal number instead of two separately-computed ones
    // that happen to be close.
    height: 46,
    paddingHorizontal: space.md,
  },
  manualToggleText: { ...type.headingSm, color: palette.primaryDeep },
});
