import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, shadow, space, type } from "../theme";
import { PrimaryButton } from "./PrimaryButton";

// Shared by "Uložit do Mých míst" (map -> new saved location) and the
// rename pencil in Moje (existing saved location) - same shape either way,
// just a name and a confirm.
export function NamePromptModal({
  title,
  initialValue,
  confirmLabel = "Uložit",
  onConfirm,
  onCancel,
}: {
  title: string;
  initialValue: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      {/* iOS doesn't resize/reposition a centered Modal when the keyboard
          opens (same issue BottomSheet.tsx's KeyboardAvoidingView already
          works around) - without this, autoFocus on the input below meant
          the keyboard came up immediately and could cover this centered
          card entirely, with no way to see what's being typed. Android
          already resizes the window itself. */}
      <KeyboardAvoidingView style={styles.backdropWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.title}>{title}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="Název místa"
              placeholderTextColor={palette.inkFaint}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => onConfirm(value.trim() || initialValue)}
            />
            <View style={styles.row}>
              <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Zrušit</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={confirmLabel} onPress={() => onConfirm(value.trim() || initialValue)} />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000033",
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.lg,
  },
  title: { ...type.headingSm, color: palette.ink, marginBottom: space.sm },
  input: {
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: 14.5,
    color: palette.ink,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  cancelBtn: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  cancelText: { ...type.body, color: palette.inkFaint },
});
