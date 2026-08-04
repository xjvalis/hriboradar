import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { palette, radius, space, type } from "../theme";

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        (disabled || loading) && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? palette.white : palette.primary} size="small" />
      ) : (
        <Text style={[styles.label, variant === "secondary" && styles.labelSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: palette.primary },
  btnDisabled: { opacity: 0.45 },
  label: { ...type.headingSm, color: palette.white },
  labelSecondary: { color: palette.primary },
});
