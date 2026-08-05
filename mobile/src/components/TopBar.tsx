import { Pressable, StyleSheet, View } from "react-native";
import { Home, Map, MapPin, Settings } from "lucide-react-native";
import { palette, radius, space } from "../theme";
import { BrandMark } from "./BrandMark";

export type ScreenName = "Domů" | "Mapa" | "Moje" | "Nastavení";

const ITEMS: { name: ScreenName; Icon: typeof Home }[] = [
  { name: "Domů", Icon: Home },
  { name: "Mapa", Icon: Map },
  { name: "Moje", Icon: MapPin },
  { name: "Nastavení", Icon: Settings },
];

export function TopBar({
  active,
  onNavigate,
}: {
  active: ScreenName;
  onNavigate: (screen: ScreenName) => void;
}) {
  return (
    <View style={styles.bar}>
      <BrandMark size="sm" />
      <View style={styles.icons}>
        {ITEMS.map(({ name, Icon }) => {
          const isActive = name === active;
          return (
            <Pressable
              key={name}
              onPress={() => onNavigate(name)}
              style={[styles.iconBtn, isActive && styles.iconBtnActive]}
              hitSlop={8}
            >
              <Icon size={19} strokeWidth={1.8} color={palette.wood} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.bg,
  },
  icons: { flexDirection: "row", gap: space.sm },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  iconBtnActive: { borderColor: palette.springGreen },
});
