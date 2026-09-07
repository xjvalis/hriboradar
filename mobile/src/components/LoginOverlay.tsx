import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { palette, space, ts } from "../theme";
import { useAuth } from "../AuthContext";
import { useAuthScreen } from "../AuthScreenContext";
import LoginScreen from "../screens/LoginScreen";

// Wraps the same LoginScreen that used to be the app's unavoidable root
// screen (see App.tsx) as an on-demand overlay instead - opened via
// useAuthScreen().openLogin() from whatever account-based feature needed
// it (a browsing-only visitor never sees this unless they ask to sign in).
// Closes itself the instant a session actually lands, same as the old
// root-gate did implicitly by just unmounting LoginScreen once `user`
// existed - here that has to be explicit since this stays mounted
// alongside the rest of the app instead of replacing it.
export function LoginOverlay() {
  const { isOpen, closeLogin } = useAuthScreen();
  const { user } = useAuth();

  useEffect(() => {
    if (user && isOpen) closeLogin();
  }, [user, isOpen, closeLogin]);

  if (!isOpen || user) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={closeLogin} hitSlop={8} style={styles.headerBtn}>
            <X size={ts(20)} strokeWidth={2} color={palette.ink} />
          </Pressable>
        </View>
        <LoginScreen />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerBtn: { alignSelf: "flex-start", padding: space.xs },
});
