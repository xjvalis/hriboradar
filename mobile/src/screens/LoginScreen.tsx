import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { palette, radius, space, ts, type } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { PaperBackground } from "../components/PaperBackground";
import { MorelLogo } from "../components/MorelLogo";
import { useAuth } from "../AuthContext";

// Deliberately permissive (catches "obviously not an email," not full RFC
// 5322) - the point is fast feedback on a typo before a network round
// trip, not being the source of truth. Supabase still validates for real.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "signin" | "signup" | "forgot";

export default function LoginScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    requestPasswordReset,
    isConfigured,
  } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function submitEmail() {
    setError(null);
    setInfo(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError("Zadejte platný e-mail.");
      return;
    }

    if (mode === "forgot") {
      setBusy(true);
      const { error, info } = await requestPasswordReset(email.trim());
      setBusy(false);
      if (error) setError(error);
      else if (info) setInfo(info);
      return;
    }

    // Only enforce a real minimum on sign-up - sign-in just needs "not
    // empty" so this can never lock someone out of a password that was
    // valid under a rule set at the time they created it. 8, not 6:
    // length matters far more than complexity rules for real-world
    // password strength (NIST SP 800-63B), so a plain, slightly higher
    // floor beats demanding digits/symbols/etc.
    if (mode === "signup" ? password.length < 8 : password.length === 0) {
      setError(mode === "signup" ? "Heslo musí mít alespoň 8 znaků." : "Zadejte heslo.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Hesla se neshodují.");
      return;
    }

    setBusy(true);
    const { error, info } =
      mode === "signin" ? await signInWithEmail(email.trim(), password) : await signUpWithEmail(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else if (info) setInfo(info);
  }

  async function submitGoogle() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) setError(error);
  }

  async function submitApple() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error } = await signInWithApple();
    setBusy(false);
    if (error) setError(error);
  }

  const title = mode === "forgot" ? "Obnovit heslo" : "Hřiboradar";
  const tagline =
    mode === "forgot"
      ? "Zadejte e-mail, na který vám pošleme odkaz na obnovení hesla."
      : "Vaše houbařská appka - přihlaste se a jdeme na to.";
  const submitLabel = mode === "signin" ? "Přihlásit se" : mode === "signup" ? "Vytvořit účet" : "Odeslat odkaz";

  return (
    // iOS doesn't resize/reposition anything on its own when the keyboard
    // opens (same issue BottomSheet.tsx/NamePromptModal.tsx already work
    // around) - without this, the password field or submit button could
    // end up hidden behind the keyboard depending on which mode/field was
    // focused. Android already resizes the window itself.
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Tapping anywhere that isn't itself a focusable input/button
            dismisses the keyboard - a nested Pressable/TextInput touch
            claims the responder first, so this only fires for genuinely
            empty space, not every tap inside the form. */}
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
      <PaperBackground style={styles.content}>
        <View style={styles.header}>
          <MorelLogo height={mode === "forgot" ? 56 : 72} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        {!isConfigured && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Přihlášení zatím není nastavené (chybí propojení na Supabase) - obrazovka je hotová, funkčnost
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

          {mode !== "forgot" && (
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Heslo"
                placeholderTextColor={palette.inkFaint}
                secureTextEntry={!showPassword}
                autoComplete={mode === "signin" ? "password" : "new-password"}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                {showPassword ? (
                  <EyeOff size={ts(18)} strokeWidth={1.8} color={palette.inkFaint} />
                ) : (
                  <Eye size={ts(18)} strokeWidth={1.8} color={palette.inkFaint} />
                )}
              </Pressable>
            </View>
          )}

          {mode === "signup" && (
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Heslo znovu"
              placeholderTextColor={palette.inkFaint}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />
          )}

          {mode === "signin" && (
            <Text style={styles.forgotLink} onPress={() => switchMode("forgot")}>
              Zapomenuté heslo?
            </Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <PrimaryButton label={submitLabel} onPress={submitEmail} loading={busy} />

          {mode === "forgot" ? (
            <Text style={styles.toggle} onPress={() => switchMode("signin")}>
              Zpět na přihlášení
            </Text>
          ) : (
            <Text style={styles.toggle} onPress={() => switchMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Nemáte účet? Zaregistrovat se" : "Už máte účet? Přihlásit se"}
            </Text>
          )}
        </View>

        {mode !== "forgot" && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>nebo</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialCol}>
              <GoogleSignInButton label="Pokračovat přes Google" onPress={submitGoogle} disabled={busy} />
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
          </>
        )}
      </PaperBackground>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: space.xxl },
  eyeBtn: { position: "absolute", right: space.md },
  forgotLink: { ...type.caption, color: palette.primary, textAlign: "right" },
  error: { ...type.bodySmall, color: palette.danger },
  info: { ...type.bodySmall, color: palette.success },
  toggle: { ...type.bodySmall, color: palette.primary, textAlign: "center", marginTop: space.xs },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: space.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.line },
  dividerText: { ...type.caption, color: palette.inkFaint },
  socialCol: { gap: space.sm },
  appleButton: { width: "100%", height: 46 },
});
