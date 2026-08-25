import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { API_BASE } from "./api";

WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  error: string | null;
  // Set (with error: null) when the call "succeeded" but doesn't produce a
  // session yet - currently just the signUp-with-email-confirmation-on
  // case. Without this, a successful signup under Supabase's default
  // "Confirm email" setting looks identical to the login screen doing
  // nothing at all, since no session ever arrives to flip the app past it.
  info?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  // True from the moment a password-recovery link opens the app until a
  // new password is set - App.tsx uses this to force the "set new
  // password" screen ahead of the normal login/main-app branch, even
  // though Supabase's recovery link does technically hand back a session.
  passwordRecovery: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  setNewPassword: (newPassword: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

const NOT_CONFIGURED_ERROR = "Přihlášení zatím není nastavené - zkuste to prosím později.";

// Supabase's error messages come back in English regardless of app locale
// - translating the handful anyone actually hits in normal use so the
// screen never shows raw SDK text next to otherwise all-Czech copy.
function translateAuthError(message: string): string {
  const known: [string, string][] = [
    ["Email not confirmed", "E-mail ještě není potvrzený - zkontrolujte schránku a klikněte na odkaz v potvrzovacím e-mailu."],
    ["Invalid login credentials", "Nesprávný e-mail nebo heslo."],
    ["User already registered", "Účet s tímhle e-mailem už existuje - zkuste se rovnou přihlásit."],
    ["Password should be at least", "Heslo je příliš krátké."],
    // Supabase's built-in email sender (no custom SMTP configured) is
    // rate-limited to a handful of emails/hour - expected during active
    // testing of signup, not a real app bug.
    ["email rate limit exceeded", "Příliš mnoho registrací za krátkou dobu - Supabase dočasně omezuje odesílání potvrzovacích e-mailů. Zkuste to za chvíli, nebo si v Supabase dashboardu (Authentication → Providers → Email) dočasně vypněte 'Confirm email' pro testování."],
  ];
  const hit = known.find(([needle]) => message.includes(needle));
  return hit ? hit[1] : message;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Gates the whole app (see App.tsx) - nothing renders past the login
// screen without a session. Supabase handles the actual auth (email/
// password + Google + Apple); this context just wraps its client SDK in
// the same shape as the app's other providers and adds the Expo-specific
// OAuth redirect dance Supabase's web-first docs don't cover.
//
// Wired against real Supabase calls from day one rather than stubbed -
// isSupabaseConfigured is false until EXPO_PUBLIC_SUPABASE_URL/ANON_KEY
// are set (see .env.example), so every method below fails with a clear
// Czech message instead of a network error until then. Nothing else needs
// to change once those two values exist.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // Falls through to "no session" (the login screen) on failure rather
    // than leaving loading stuck true forever - a rejected promise here
    // (bad network, corrupted secure storage on startup) would otherwise
    // strand the app on the loading screen permanently with no recovery
    // short of reinstalling.
    supabase.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }

  async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    // signUp() succeeds (no error) even when email confirmation is
    // required - it just doesn't hand back a session yet. Without this
    // check, a real success looks identical to a silent no-op.
    if (!data.session) {
      return {
        error: null,
        info: "Účet vytvořen - zkontrolujte e-mail a potvrďte registraci, pak se přihlaste.",
      };
    }
    return { error: null };
  }

  // Supabase's signInWithOAuth() is built for the web (it just redirects
  // the page); on native it instead hands back a URL we open ourselves in
  // an in-app browser tab, then have to pull the tokens back out of the
  // redirect URL by hand - expo-auth-session/expo-web-browser cover that
  // gap, but neither is Supabase-aware, so this glue has to live here.
  async function signInWithGoogle(): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const redirectTo = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return { error: error ? translateAuthError(error.message) : "Nepodařilo se spustit přihlášení přes Google." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !result.url) return { error: null }; // user backed out - not an error

    const hash = result.url.split("#")[1] ?? "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return { error: "Přihlášení přes Google se nezdařilo." };

    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error: sessionError ? translateAuthError(sessionError.message) : null };
  }

  // Apple's native SDK hands back an identity token directly - no
  // redirect/browser dance needed, Supabase accepts it as-is.
  async function signInWithApple(): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    if (Platform.OS !== "ios") return { error: "Přihlášení přes Apple je dostupné jen na iOS." };
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { error: "Apple nevrátilo přihlašovací token." };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      return { error: error ? translateAuthError(error.message) : null };
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "ERR_REQUEST_CANCELED") {
        return { error: null }; // user backed out
      }
      return { error: "Přihlášení přes Apple se nezdařilo." };
    }
  }

  // Deliberately the same message whether or not the address has an
  // account - confirming/denying account existence to an unauthenticated
  // caller is a standard enumeration risk (OWASP ASVS 2.2.1), not just a
  // UX nicety.
  async function requestPasswordReset(email: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const redirectTo = AuthSession.makeRedirectUri();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: null, info: "Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz na obnovení hesla." };
  }

  async function setNewPassword(newPassword: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: translateAuthError(error.message) };
    setPasswordRecovery(false);
    return { error: null };
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }

  // Deletes the account server-side (needs the service_role key, see
  // api/account-delete.ts) then clears the local session - on delete
  // cascade in rostou_schema.sql takes every saved location/feedback/
  // notification row with it, there's nothing left to clean up here.
  async function deleteAccount(): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "Neplatné přihlášení." };
    try {
      const res = await fetch(`${API_BASE}/api/account-delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { error: body?.error ?? "Smazání účtu se nezdařilo." };
      }
    } catch {
      return { error: "Smazání účtu se nezdařilo - zkontrolujte připojení k internetu." };
    }
    setPasswordRecovery(false);
    await supabase.auth.signOut();
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        passwordRecovery,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        requestPasswordReset,
        setNewPassword,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
