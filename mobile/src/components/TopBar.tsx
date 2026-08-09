import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Menu } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BrandMark } from "./BrandMark";
import { useNotifications } from "../NotificationContext";

export type ScreenName = "Domů" | "Mapa" | "Předpověď" | "Houby" | "Moje" | "Nastavení";

export function TopBar({ onMenuPress }: { onMenuPress: () => void }) {
  const { unreadCount, openSheet } = useNotifications();

  return (
    <View style={styles.bar}>
      <Pressable onPress={onMenuPress} hitSlop={8} style={styles.iconBtn}>
        <Menu size={22} strokeWidth={1.8} color={palette.wood} />
      </Pressable>
      <View style={styles.center}>
        <BrandMark size="sm" />
      </View>
      <Pressable onPress={openSheet} hitSlop={8} style={styles.iconBtn}>
        <Bell size={21} strokeWidth={1.8} color={palette.wood} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </Pressable>
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
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center" },
  badge: {
    position: "absolute",
    top: 3,
    right: 2,
    minWidth: 15,
    height: 15,
    borderRadius: radius.pill,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.bg,
  },
  badgeText: { ...type.caption, fontSize: 9, lineHeight: 10, color: palette.white, fontFamily: "Manrope-Bold" },
});
