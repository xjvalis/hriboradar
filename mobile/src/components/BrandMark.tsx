import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { palette, type } from "../theme";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 20 : 24;
  return (
    <View style={styles.row}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 32 32">
        <Ellipse cx={16} cy={22} rx={4} ry={8} fill={palette.inkFaint} />
        <Path d="M4 16 Q16 2 28 16 Q22 21 16 21 Q10 21 4 16 Z" fill={palette.primary} />
      </Svg>
      <Text style={[styles.text, size === "sm" && styles.textSm]}>Rostou?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  text: { ...type.headingLg, color: palette.ink },
  textSm: { fontSize: 16, lineHeight: 20 },
});
