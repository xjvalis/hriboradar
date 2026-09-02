import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Chip } from "./Chip";
import { PrimaryButton } from "./PrimaryButton";
import { submitFeedback } from "../api";
import { SPECIES_BY_ID } from "../speciesInfo";
import type { SavedLocation } from "../SavedLocationsContext";

type QuantityBucket = "few" | "basket" | "lots";

const QUANTITY_OPTIONS: { value: QuantityBucket; label: string }[] = [
  { value: "few", label: "Pár kousků" },
  { value: "basket", label: "Košík" },
  { value: "lots", label: "Hodně" },
];

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// Ground truth the scoring model has no other way to get: did mushrooms
// actually turn up where the app said they might? This is what closes the
// feedback loop - the server recomputes what was predicted for this exact
// location/date/species (see api/feedback.ts) and feeds it into the
// calibration job, which only ever nudges future forecasts once enough
// observations have piled up (never from a single click).
export function ObservationSheet({
  location,
  onClose,
}: {
  location: SavedLocation;
  onClose: () => void;
}) {
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [found, setFound] = useState<boolean | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<QuantityBucket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSpecies = Object.values(SPECIES_BY_ID);

  function toggleSpecies(id: string) {
    setSelectedSpecies((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function submit() {
    if (found === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await submitFeedback({
        lat: location.lat,
        lon: location.lon,
        targetDate: dateOffset(day === "today" ? 0 : -1),
        found,
        speciesIds: found ? selectedSpecies : [],
        quantityBucket: found ? quantity : null,
      });
      if (ok) setDone(true);
      else setError("Nepodařilo se odeslat zpětnou vazbu - zkuste to prosím znovu.");
    } catch {
      setError("Nepodařilo se odeslat zpětnou vazbu - zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <BottomSheet onClose={onClose}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>Díky za zpětnou vazbu</Text>
          <Text style={styles.doneBody}>
            Tahle pozorování časem pomůžou zpřesnit předpověď - čím víc jich posbíráme, tím lepší bude
            model pro všechny.
          </Text>
          <View style={{ marginTop: space.base, alignSelf: "stretch" }}>
            <PrimaryButton label="Zavřít" onPress={onClose} />
          </View>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} maxHeight="85%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{location.label}</Text>

        <View style={styles.dayRow}>
          <Chip label="Dnes" active={day === "today"} onPress={() => setDay("today")} />
          <Chip label="Včera" active={day === "yesterday"} onPress={() => setDay("yesterday")} />
        </View>

        <Text style={styles.subtitle}>Byly tam {day === "today" ? "dnes" : "včera"} houby?</Text>

        <View style={styles.choiceRow}>
          <Pressable
            style={[styles.choice, found === true && styles.choiceActiveGood]}
            onPress={() => setFound(true)}
          >
            <CheckCircle2 size={ts(22)} strokeWidth={1.8} color={found === true ? palette.success : palette.inkFaint} />
            <Text style={[styles.choiceText, found === true && styles.choiceTextGood]}>Ano, rostly</Text>
          </Pressable>
          <Pressable
            style={[styles.choice, found === false && styles.choiceActiveBad]}
            onPress={() => setFound(false)}
          >
            <XCircle size={ts(22)} strokeWidth={1.8} color={found === false ? palette.danger : palette.inkFaint} />
            <Text style={[styles.choiceText, found === false && styles.choiceTextBad]}>Ne, nic tam nebylo</Text>
          </Pressable>
        </View>

        {found === true && (
          <>
            <Text style={styles.sectionLabel}>Které druhy (nepovinné)</Text>
            <View style={styles.chipWrap}>
              {allSpecies.map((sp) => (
                <Chip
                  key={sp.id}
                  label={sp.name_cz}
                  active={selectedSpecies.includes(sp.id)}
                  onPress={() => toggleSpecies(sp.id)}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Kolik přibližně (nepovinné)</Text>
            <View style={styles.chipWrap}>
              {QUANTITY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={quantity === opt.value}
                  onPress={() => setQuantity((prev) => (prev === opt.value ? null : opt.value))}
                />
              ))}
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton label="Odeslat pozorování" onPress={submit} disabled={found === null} loading={submitting} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: 0, paddingBottom: space.xl },
  title: { ...type.headingLg, color: palette.ink, marginTop: space.sm },
  dayRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  subtitle: { ...type.body, color: palette.inkSoft, marginTop: space.sm, marginBottom: space.md },
  choiceRow: { flexDirection: "row", gap: space.sm },
  choice: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  choiceActiveGood: { borderColor: palette.success, backgroundColor: palette.success + "14" },
  choiceActiveBad: { borderColor: palette.danger, backgroundColor: palette.danger + "14" },
  choiceText: { ...type.bodySmall, color: palette.inkSoft, textAlign: "center" },
  choiceTextGood: { color: palette.success, fontFamily: "Manrope-SemiBold" },
  choiceTextBad: { color: palette.danger, fontFamily: "Manrope-SemiBold" },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.lg, marginBottom: space.sm },
  error: { ...type.bodySmall, color: palette.danger, marginTop: space.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  doneWrap: { padding: space.lg, paddingTop: space.sm, alignItems: "center" },
  doneTitle: { ...type.headingLg, color: palette.ink, textAlign: "center" },
  doneBody: { ...type.body, color: palette.inkSoft, textAlign: "center", marginTop: space.sm },
});
