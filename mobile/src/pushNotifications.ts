import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { API_BASE } from "./api";

// expo-notifications has native code, same crash risk as expo-location/
// react-native-purchases (see LocationPickerSheet.tsx's comment on the same
// pattern) - a static import throws synchronously if the native module
// isn't linked into the running binary yet, which would take down the
// whole app on launch. Guarded require() so it degrades to "push isn't
// available yet" instead, until a real EAS build includes it.
let ExpoNotifications: typeof import("expo-notifications") | null;
try {
  ExpoNotifications = require("expo-notifications");
} catch {
  ExpoNotifications = null;
}

// Foreground behavior: still show the alert/sound even while the app is
// open, same as any notification arriving while it's backgrounded - a
// houbařský pes alert is worth seeing right away, not silently swallowed
// just because the app happened to be in front.
ExpoNotifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push permission (if not already decided) and registers this
 * device's Expo push token against the signed-in user - see api/push-token.ts
 * and api/cron/watchdog.ts / lib/monthlyTip.ts, which is what actually
 * sends to it.
 *
 * Called contextually - from LocationAlertsSheet.tsx when someone turns a
 * watchdog on, and from SettingsNotificationsSection.tsx when someone
 * flips the "Měsíční tip" switch - not unconditionally at app launch;
 * asking for notification permission before the user has done anything
 * notification-related reads as a cold-open nag, not a feature. Safe to
 * call again on a later launch (e.g. from a "re-sync" spot) - already-
 * granted/denied permission is a no-op on both iOS and Android, and Expo
 * tokens can rotate, so refreshing it periodically for someone who
 * already opted in is worthwhile.
 *
 * `monthlyTipEnabled` is optional and only forwarded when the caller has
 * an actual opinion on it (the Settings toggle) - omitting it leaves
 * whatever the server already has alone, see api/push-token.ts.
 *
 * Resolves to true on success, false on anything that means "no push for
 * now" (no native module, permission denied, offline) - callers should
 * treat false as "fine, this device just won't get one" rather than an
 * error, since the watchdog itself still works via e-mail either way.
 */
export async function registerForPushNotificationsAsync(monthlyTipEnabled?: boolean): Promise<boolean> {
  if (!ExpoNotifications || Platform.OS === "web") return false;

  try {
    if (Platform.OS === "android") {
      await ExpoNotifications.setNotificationChannelAsync("default", {
        name: "Houbařský pes",
        importance: ExpoNotifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existing } = await ExpoNotifications.getPermissionsAsync();
    const finalStatus = existing === "granted" ? existing : (await ExpoNotifications.requestPermissionsAsync()).status;
    if (finalStatus !== "granted") return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return false;
    const { data: tokenData } = await ExpoNotifications.getExpoPushTokenAsync({ projectId });

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return false;

    const res = await fetch(`${API_BASE}/api/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        token: tokenData,
        platform: Platform.OS,
        ...(monthlyTipEnabled != null ? { monthlyTipEnabled } : {}),
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[push] registration failed (native module unavailable until a new EAS build?)", e);
    return false;
  }
}
