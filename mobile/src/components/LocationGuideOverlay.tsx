import { StyleSheet, Text, View } from "react-native";
import { Search, MapPinned, TreePine } from "lucide-react-native";
import { palette, radius, space, ts, type, shadow } from "../theme";
import { PrimaryButton } from "./PrimaryButton";

// Shown the first time anyone opens the map location picker (and again
// any time they tap the header's help icon) - a first real user spent a
// while fighting the map, repeatedly landing on their own house in the
// middle of a village and getting a low score, before it had to be
// explained by hand that the pin needs to sit in actual forest, not on a
// building (found 2026-09-04). Three short steps beat a wall of text -
// the goal is "glance at this once, get it," not a tutorial to read.
const STEPS: { icon: typeof Search; title: string; body: string }[] = [
  {
    icon: Search,
    title: "Najděte svoje okolí",
    body: "Zadejte název obce nebo adresu poblíž místa, které vás zajímá.",
  },
  {
    icon: MapPinned,
    title: "Upravte špendlík",
    body: "Přetáhněte ho přesně tam, kam chodíte na houby.",
  },
  {
    icon: TreePine,
    title: "Mimo zástavbu",
    body: "Vyberte kousek lesa nebo remízek, ne přímo dům ve vesnici - jinak appka uvidí jen zástavbu a ukáže nízkou šanci.",
  },
];

export function LocationGuideOverlay({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Jak vybrat svoje místo</Text>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepIcon}>
              <s.icon size={ts(18)} strokeWidth={1.8} color={palette.primary} />
            </View>
            <View style={styles.stepTextCol}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}
        <PrimaryButton label="Rozumím, jdu na to" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(36,38,29,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    width: "100%",
    maxWidth: 380,
    ...shadow.sheet,
  },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.xs },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepIcon: {
    width: ts(32),
    height: ts(32),
    borderRadius: radius.pill,
    backgroundColor: palette.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  stepTextCol: { flex: 1 },
  stepTitle: { ...type.headingSm, color: palette.ink },
  stepBody: { ...type.bodySmall, color: palette.inkSoft, marginTop: 2 },
});
