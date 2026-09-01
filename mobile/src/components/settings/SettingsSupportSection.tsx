import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Bug, Check, Copy } from "lucide-react-native";
import { palette, space, type } from "../../theme";

const SUPPORT_EMAIL = "podpora@hriboradar.app";

export function SettingsSupportSection() {
  const [emailCopied, setEmailCopied] = useState(false);

  async function copySupportEmail() {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  return (
    <View style={styles.padded}>
      <View style={styles.supportRow}>
        <Bug size={16} strokeWidth={1.8} color={palette.inkFaint} />
        <Text style={styles.supportText}>
          Pro podporu nebo nahlášení chyby napište na <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
        </Text>
        <Pressable onPress={copySupportEmail} hitSlop={8} style={styles.copyBtn}>
          {emailCopied ? (
            <Check size={15} strokeWidth={2} color={palette.success} />
          ) : (
            <Copy size={15} strokeWidth={1.8} color={palette.inkFaint} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.lg },
  supportRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  supportText: { ...type.caption, color: palette.inkFaint, flex: 1, lineHeight: 15 },
  supportEmail: { color: palette.inkSoft, fontFamily: "Manrope-SemiBold" },
  copyBtn: { padding: 4 },
});
