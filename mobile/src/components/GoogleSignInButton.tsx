import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fontFamily, radius, space } from "../theme";

// Google's official four-color "G" mark - required as-is (not recolored,
// not swapped for a generic icon) by Google's Sign In branding guidelines
// whenever a "Continue/Sign in with Google" button is shown. Everything
// else about the button (corner radius, font, exact copy) is allowed to
// follow the host app's own style, which is why this uses the app's pill
// radius and Manrope instead of Google's own Roboto spec.
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <Path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </Svg>
  );
}

export function GoogleSignInButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed, disabled && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#3C4043" />
      ) : (
        <>
          <View style={styles.glyph}>
            <GoogleGlyph />
          </View>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#DADCE0",
    backgroundColor: "#FFFFFF",
  },
  buttonPressed: { backgroundColor: "#F7F8F8" },
  buttonDisabled: { opacity: 0.6 },
  glyph: { position: "absolute", left: space.md },
  // Google's spec calls for Roboto Medium 14sp - not bundled here, so
  // Manrope Medium is the closest weight/size match already in the app.
  label: { fontFamily: fontFamily.uiMedium, fontSize: 14.5, color: "#3C4043" },
});
