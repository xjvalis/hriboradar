import { StyleSheet, Text, View } from "react-native";
import { palette, ts, type } from "../theme";
import { MorelLogo } from "./MorelLogo";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const iconHeight = ts(size === "sm" ? 24 : 28);
  return (
    <View style={styles.row}>
      <MorelLogo height={iconHeight} />
      <Text style={[styles.text, size === "sm" && styles.textSm]}>Hřiboradar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  text: { ...type.headingLg, color: palette.ink },
  textSm: { fontSize: ts(16), lineHeight: ts(20) },
});
