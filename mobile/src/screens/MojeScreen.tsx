import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, BellOff, Pencil, Sprout, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { EmptyState } from "../components/EmptyState";
import { MushroomQuestionIcon } from "../components/MushroomQuestionIcon";
import { LocationSearchInput } from "../components/LocationSearchInput";
import { LocationMapPicker } from "../components/LocationMapPicker";
import { ObservationSheet } from "../components/ObservationSheet";
import { NamePromptModal } from "../components/NamePromptModal";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { useLocation, type AppLocation } from "../LocationContext";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";
import { FREE_SAVED_LOCATIONS_LIMIT } from "../subscriptionLimits";

function placesLabel(n: number): string {
  if (n === 1) return "1 uložené místo";
  if (n >= 2 && n <= 4) return `${n} uložená místa`;
  return `${n} uložených míst`;
}

export default function MojeScreen() {
  const { locations, addLocation, removeLocation, toggleLocationAlerts, renameLocation } = useSavedLocations();
  const { setLocation } = useLocation();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const [observing, setObserving] = useState<SavedLocation | null>(null);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [renaming, setRenaming] = useState<SavedLocation | null>(null);

  // Free tier: one saved place, enough to actually use the app (your own
  // backyard/nearest forest) - more than one is the "I go to several
  // specific spots" behavior that's worth paying for. Renaming/removing
  // an existing place is never gated, only *adding* a new one past the
  // limit.
  function addLocationGated(loc: AppLocation) {
    if (!isPremium && locations.length >= FREE_SAVED_LOCATIONS_LIMIT) {
      openPaywall("Chcete uložit víc než jedno místo?");
      return;
    }
    addLocation(loc);
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
        <LocationSearchInput onSelect={addLocationGated} />
        <Pressable onPress={() => setPickingOnMap(true)} hitSlop={6} style={styles.manualToggle}>
          <Text style={styles.manualToggleText}>+ Najít na mapě (chalupa, oblíbený lesík…)</Text>
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
                <Pressable style={{ flex: 1 }} onPress={() => setLocation(loc)}>
                  <Text style={styles.cardLabel}>{loc.label}</Text>
                  <Text style={styles.cardCoords}>
                    {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => toggleLocationAlerts(loc.id)} hitSlop={6} style={styles.iconBtn}>
                  {alertsOn ? (
                    <Bell size={19} strokeWidth={1.8} color={palette.primary} />
                  ) : (
                    <BellOff size={19} strokeWidth={1.8} color={palette.inkFaint} />
                  )}
                </Pressable>
                <Pressable onPress={() => setObserving(loc)} hitSlop={6} style={styles.iconBtn}>
                  <MushroomQuestionIcon size={19} color={palette.secondary} />
                </Pressable>
                <Pressable onPress={() => setRenaming(loc)} hitSlop={6} style={styles.iconBtn}>
                  <Pencil size={18} strokeWidth={1.8} color={palette.inkFaint} />
                </Pressable>
                <Pressable onPress={() => removeLocation(loc.id)} hitSlop={6} style={styles.iconBtn}>
                  <Trash2 size={19} strokeWidth={1.8} color={palette.inkFaint} />
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
  manualToggle: { marginTop: space.sm, alignSelf: "flex-start" },
  manualToggleText: { ...type.bodySmall, color: palette.primary },
});
