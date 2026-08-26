import { StyleSheet, Text, View } from "react-native";
import { palette, type } from "../theme";
import { MorelLogo } from "./MorelLogo";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const iconHeight = size === "sm" ? 24 : 28;
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
  textSm: { fontSize: 16, lineHeight: 20 },
});
