import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Filled in later once a Supabase project exists - see .env.example at the
// repo root for exactly which two values to set. Expo inlines anything
// prefixed EXPO_PUBLIC_ into the client bundle at build time; these are
// meant to be public (protected by Supabase's Row Level Security on the
// server side, not by keeping the anon key secret).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// Session tokens are credentials, not app data - AsyncStorage is plain
// unencrypted disk storage (readable by anyone with device/backup access),
// which is exactly the "insecure data storage" pattern OWASP Mobile flags.
// expo-secure-store instead backs onto iOS Keychain / Android Keystore.
// It doesn't exist on web (no OS-level secure enclave to use), so web
// keeps AsyncStorage there - same tradeoff every web app already makes
// with browser storage, not something SecureStore could fix anyway.
const authStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };

// A real client always exists (createClient doesn't itself make a network
// call), even with empty strings - isSupabaseConfigured is what call sites
// should actually check before relying on it working, so the app can show
// a clear "not set up yet" state instead of a confusing network error.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
