import { StyleSheet, Text, View } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { palette, space, type } from "../theme";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Icon size={40} strokeWidth={1.4} color={palette.inkFaint} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl },
  title: { ...type.headingSm, color: palette.ink, marginTop: space.base, textAlign: "center" },
  description: {
    ...type.bodySmall,
    color: palette.inkSoft,
    marginTop: space.xs,
    textAlign: "center",
  },
});
