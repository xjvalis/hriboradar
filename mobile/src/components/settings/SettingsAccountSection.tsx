import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyRound, LogOut, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../../theme";
import { ChangePasswordSheet } from "../ChangePasswordSheet";
import { useAuth } from "../../AuthContext";

export function SettingsAccountSection() {
  const { user, signOut, deleteAccount } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  // Google/Apple-only accounts have no password to change - Supabase marks
  // this on the user's identities array (one entry per linked provider),
  // not on app_metadata.provider (which is just "which one they used most
  // recently", not "which ones exist").
  const hasPasswordAuth = user?.identities?.some((i) => i.provider === "email") ?? false;

  function confirmDeleteAccount() {
    Alert.alert(
      "Smazat účet?",
      "Nevratně smažete účet a všechna uložená data - místa, upozornění i historii nálezů. Tuhle akci nejde vzít zpět.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat účet",
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) Alert.alert("Nepodařilo se smazat účet", error);
          },
        },
      ]
    );
  }

  return (
    <View style={styles.padded}>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>{user?.email ?? "Přihlášeno"}</Text>
      </View>
      {hasPasswordAuth && (
        <Pressable style={styles.changePasswordBtn} onPress={() => setChangingPassword(true)} hitSlop={4}>
          <KeyRound size={16} strokeWidth={1.8} color={palette.ink} />
          <Text style={styles.btnText}>Změnit heslo</Text>
        </Pressable>
      )}
      <View style={styles.accountActions}>
        <Pressable style={styles.signOutBtn} onPress={signOut} hitSlop={4}>
          <LogOut size={16} strokeWidth={1.8} color={palette.ink} />
          <Text style={styles.btnText}>Odhlásit se</Text>
        </Pressable>
        <Pressable style={styles.deleteAccountBtn} onPress={confirmDeleteAccount} hitSlop={4}>
          <Trash2 size={16} strokeWidth={1.8} color={palette.danger} />
          <Text style={styles.deleteAccountBtnText}>Smazat účet</Text>
        </Pressable>
      </View>
      {changingPassword && <ChangePasswordSheet onClose={() => setChangingPassword(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.lg },
  currentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
  },
  currentLabel: { ...type.headingSm, color: palette.ink },
  changePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    marginTop: space.sm,
  },
  accountActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  signOutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
  },
  btnText: { ...type.bodySmall, color: palette.ink, fontFamily: "Manrope-SemiBold" },
  deleteAccountBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.danger + "14",
    borderWidth: 1,
    borderColor: palette.danger + "33",
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
  },
  deleteAccountBtnText: { ...type.bodySmall, color: palette.danger, fontFamily: "Manrope-SemiBold" },
});
