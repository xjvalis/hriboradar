import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { PrimaryButton } from "./PrimaryButton";
import { useAuth } from "../AuthContext";

// Reuses AuthContext.setNewPassword - previously only reachable from
// NewPasswordScreen's post-recovery-link flow. This is the same call, just
// triggered voluntarily from Settings instead of after a "forgot password"
// email link.
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }
    setBusy(true);
    const { error } = await setNewPassword(password);
    setBusy(false);
    if (error) setError(error);
    else setDone(true);
  }

  if (done) {
    return (
      <BottomSheet onClose={onClose}>
        <View style={styles.content}>
          <Text style={styles.title}>Heslo změněno</Text>
          <Text style={styles.hint}>Nové heslo je platné hned - není potřeba se znovu přihlašovat.</Text>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.content}>
        <Text style={styles.title}>Změnit heslo</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Nové heslo"
          placeholderTextColor={palette.inkFaint}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Heslo znovu"
          placeholderTextColor={palette.inkFaint}
          secureTextEntry
          autoComplete="new-password"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton label="Uložit heslo" onPress={submit} loading={busy} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xl, gap: space.sm },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.xs },
  hint: { ...type.bodySmall, color: palette.inkSoft },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: ts(14),
    color: palette.ink,
  },
  error: { ...type.bodySmall, color: palette.danger },
});
