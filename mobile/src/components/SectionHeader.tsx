import { StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  title: { ...type.label, color: palette.inkSoft },
});
