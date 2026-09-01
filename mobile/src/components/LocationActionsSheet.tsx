import { Pressable, StyleSheet, Text, View } from "react-native";
import { MushroomQuestionIcon } from "./MushroomQuestionIcon";
import { Pencil, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";

// The three less-frequent per-location actions (log a find, rename,
// delete), pulled off the card row itself and behind a single "…" - a
// card used to carry 5 icon buttons (alerts, watchdog, log, rename,
// delete), which read as cluttered next to the two that actually get
// tapped often (alerts/watchdog toggles). Those two stay inline; these
// three move here.
export function LocationActionsSheet({
  locationLabel,
  onObserve,
  onRename,
  onDelete,
  onClose,
}: {
  locationLabel: string;
  onObserve: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.content}>
        <Text style={styles.title}>{locationLabel}</Text>
        <Pressable style={styles.row} onPress={() => run(onObserve)} hitSlop={4}>
          <MushroomQuestionIcon size={19} color={palette.secondary} />
          <Text style={styles.rowText}>Zapsat pozorování</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => run(onRename)} hitSlop={4}>
          <Pencil size={19} strokeWidth={1.8} color={palette.inkFaint} />
          <Text style={styles.rowText}>Přejmenovat</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => run(onDelete)} hitSlop={4}>
          <Trash2 size={19} strokeWidth={1.8} color={palette.danger} />
          <Text style={[styles.rowText, styles.dangerText]}>Smazat místo</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  title: { ...type.headingSm, color: palette.inkFaint, marginBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  rowText: { ...type.body, color: palette.ink },
  dangerText: { color: palette.danger },
});
