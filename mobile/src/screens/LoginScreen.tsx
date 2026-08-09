import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { palette, radius, space, type } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import { PaperBackground } from "../components/PaperBackground";
import { MorelLogo } from "../components/MorelLogo";
import { useAuth } from "../AuthContext";

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, isConfigured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitEmail() {
    setError(null);
    setInfo(null);
    // Only enforce a real minimum on sign-up — sign-in just needs "not
    // empty" so this can never lock someone out of a password that was
    // valid under a rule set at the time they created it. 8, not 6:
    // length matters far more than complexity rules for real-world
    // password strength (NIST SP 800-63B), so a plain, slightly higher
    // floor beats demanding digits/symbols/etc.
    if (!email.trim() || (mode === "signup" ? password.length < 8 : password.length === 0)) {
      setError(mode === "signup" ? "Zadejte e-mail a heslo (alespoň 8 znaků)." : "Zadejte e-mail a heslo.");
      return;
    }
    setBusy(true);
    const { error, info } = mode === "signin" ? await signInWithEmail(email.trim(), password) : await signUpWithEmail(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else if (info) setInfo(info);
  }

  async function submitGoogle() {
    setError(null);
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) setError(error);
  }

  async function submitApple() {
    setError(null);
    setBusy(true);
    const { error } = await signInWithApple();
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <PaperBackground style={styles.content}>
        <View style={styles.header}>
          <MorelLogo height={72} />
          <Text style={styles.title}>Rostou?</Text>
          <Text style={styles.tagline}>Vaše houbařská appka — přihlaste se a jdeme na to.</Text>
        </View>

        {!isConfigured && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Přihlášení zatím není nastavené (chybí propojení na Supabase) — obrazovka je hotová, funkčnost
              doplníme, jakmile budou k dispozici přístupové klíče.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor={palette.inkFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Heslo"
            placeholderTextColor={palette.inkFaint}
            secureTextEntry
            autoComplete={mode === "signin" ? "password" : "new-password"}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <PrimaryButton
            label={mode === "signin" ? "Přihlásit se" : "Vytvořit účet"}
            onPress={submitEmail}
            loading={busy}
          />

          <Text style={styles.toggle} onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Nemáte účet? Zaregistrovat se" : "Už máte účet? Přihlásit se"}
          </Text>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>nebo</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialCol}>
          <PrimaryButton label="Pokračovat přes Google" onPress={submitGoogle} variant="secondary" disabled={busy} />
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
              cornerRadius={radius.pill}
              style={styles.appleButton}
              onPress={submitApple}
            />
          )}
        </View>
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  header: { alignItems: "center", marginBottom: space.xl },
  title: { ...type.displayXl, color: palette.ink, marginTop: space.sm },
  tagline: { ...type.body, color: palette.inkSoft, textAlign: "center", marginTop: space.xs },
  noticeBox: {
    backgroundColor: palette.accent + "18",
    borderWidth: 1,
    borderColor: palette.accent + "44",
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.lg,
  },
  noticeText: { ...type.caption, color: palette.ink, lineHeight: 16 },
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
  info: { ...type.bodySmall, color: palette.success },
  toggle: { ...type.bodySmall, color: palette.primary, textAlign: "center", marginTop: space.xs },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: space.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.line },
  dividerText: { ...type.caption, color: palette.inkFaint },
  socialCol: { gap: space.sm },
  appleButton: { width: "100%", height: 46 },
});
