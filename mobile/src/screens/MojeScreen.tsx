import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ClipboardCheck, Sprout, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { LocationSearchInput } from "../components/LocationSearchInput";
import { ObservationSheet } from "../components/ObservationSheet";
import { useSavedLocations, type SavedLocation } from "../SavedLocationsContext";
import { useLocation } from "../LocationContext";

function placesLabel(n: number): string {
  if (n === 1) return "1 uložené místo";
  if (n >= 2 && n <= 4) return `${n} uložená místa`;
  return `${n} uložených míst`;
}

export default function MojeScreen() {
  const { locations, addLocation, removeLocation } = useSavedLocations();
  const { setLocation } = useLocation();
  const [observing, setObserving] = useState<SavedLocation | null>(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="chalupa, revír, les"
        title="Moje"
        subtitle={placesLabel(locations.length)}
      />

      <Text style={styles.sectionTitle}>Přidat místo</Text>
      <View style={styles.padded}>
        <LocationSearchInput onSelect={addLocation} />
      </View>

      {locations.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Zatím nemáte žádná uložená místa."
          description="Přidejte chalupu, revír nebo oblíbené houbařské místo výše a sledujte pro ně předpověď."
        />
      ) : (
        <View style={[styles.padded, styles.list]}>
          {locations.map((loc) => (
            <View key={loc.id} style={styles.card}>
              <Pressable style={{ flex: 1 }} onPress={() => setLocation(loc)}>
                <Text style={styles.cardLabel}>{loc.label}</Text>
                <Text style={styles.cardCoords}>
                  {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                </Text>
              </Pressable>
              <Pressable onPress={() => setObserving(loc)} hitSlop={8} style={styles.deleteBtn}>
                <ClipboardCheck size={17} strokeWidth={1.8} color={palette.secondary} />
              </Pressable>
              <Pressable onPress={() => removeLocation(loc.id)} hitSlop={8} style={styles.deleteBtn}>
                <Trash2 size={17} strokeWidth={1.8} color={palette.inkFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.note}>
        Klepnutím na místo ho nastavíte jako aktuální — Domů a Mapa se přepnou na něj. Předpověď umí
        zobrazit všechna uložená místa najednou. Ikonka se zaškrtnutím zapíše, jestli tam houby fakt
        rostly — pomáhá to zpřesňovat model.
      </Text>

      {observing && <ObservationSheet location={observing} onClose={() => setObserving(null)} />}
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
});
