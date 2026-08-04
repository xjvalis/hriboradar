import { StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: space.lg,
    paddingTop: space.base,
    paddingBottom: space.sm,
  },
  eyebrow: { ...type.eyebrow, color: palette.secondary },
  title: { ...type.displayLg, color: palette.ink, marginTop: 2 },
  subtitle: { ...type.bodySmall, color: palette.inkFaint, marginTop: 4 },
});
