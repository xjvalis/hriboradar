import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import { PaperBackground } from "../components/PaperBackground";
import { MorelLogo } from "../components/MorelLogo";
import { useAuth } from "../AuthContext";

// Shown in place of the normal login/main-app branch (see App.tsx) once
// Supabase's password-recovery link has opened the app and handed back a
// PASSWORD_RECOVERY session - the user has to set a new password here
// before doing anything else, matching how every standard "forgot
// password" flow works.
export default function NewPasswordScreen() {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <PaperBackground style={styles.content}>
        <View style={styles.header}>
          <MorelLogo height={64} />
          <Text style={styles.title}>Nové heslo</Text>
          <Text style={styles.tagline}>Zadejte nové heslo ke svému účtu.</Text>
        </View>

        <View style={styles.form}>
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
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: space.xl, paddingVertical: space.xxl },
  header: { alignItems: "center", marginBottom: space.xl },
  title: { ...type.displayLg, color: palette.ink, marginTop: space.sm },
  tagline: { ...type.body, color: palette.inkSoft, textAlign: "center", marginTop: space.xs },
  form: { gap: space.sm },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: palette.ink,
  },
  error: { ...type.bodySmall, color: palette.danger },
});
