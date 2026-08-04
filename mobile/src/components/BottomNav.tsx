import { Pressable, StyleSheet, Text, View } from "react-native";
import { Home, Map, BookOpen, MapPin } from "lucide-react-native";
import { palette, type, space } from "../theme";

export type ScreenName = "Domů" | "Mapa" | "Houby" | "Moje";

const ITEMS: { name: ScreenName; label: string; Icon: typeof Home }[] = [
  { name: "Domů", label: "Domů", Icon: Home },
  { name: "Mapa", label: "Mapa", Icon: Map },
  { name: "Houby", label: "Houby", Icon: BookOpen },
  { name: "Moje", label: "Moje", Icon: MapPin },
];

export function BottomNav({
  active,
  onNavigate,
}: {
  active: ScreenName;
  onNavigate: (screen: ScreenName) => void;
}) {
  return (
    <View style={styles.bar}>
      {ITEMS.map(({ name, label, Icon }) => {
        const isActive = name === active;
        return (
          <Pressable
            key={name}
            onPress={() => onNavigate(name)}
            style={styles.item}
            hitSlop={8}
          >
            <Icon
              size={22}
              strokeWidth={isActive ? 2.25 : 1.75}
              color={isActive ? palette.primary : palette.inkFaint}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { ...type.caption, color: palette.inkFaint },
  labelActive: { color: palette.primary, fontFamily: "Manrope-Bold" },
});
