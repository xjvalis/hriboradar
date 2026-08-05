import { Pressable, StyleSheet, View } from "react-native";
import { Menu } from "lucide-react-native";
import { palette, space } from "../theme";
import { BrandMark } from "./BrandMark";

export type ScreenName = "Domů" | "Mapa" | "Předpověď" | "Houby" | "Moje" | "Nastavení";

export function TopBar({ onMenuPress }: { onMenuPress: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onMenuPress} hitSlop={8} style={styles.menuBtn}>
        <Menu size={22} strokeWidth={1.8} color={palette.wood} />
      </Pressable>
      <View style={styles.center}>
        <BrandMark size="sm" />
      </View>
      <View style={styles.menuBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.bg,
  },
  menuBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center" },
});
