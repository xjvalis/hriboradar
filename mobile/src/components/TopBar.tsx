import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Menu } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BrandMark } from "./BrandMark";
import { useNotifications } from "../NotificationContext";

export type ScreenName = "Domů" | "Mapa" | "Předpověď" | "Houby" | "Moje" | "Nastavení";

export function TopBar({ onMenuPress, onBrandPress }: { onMenuPress: () => void; onBrandPress: () => void }) {
  const { unreadCount, openSheet } = useNotifications();

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onMenuPress}
        hitSlop={8}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Otevřít menu - Moje místa a Nastavení"
      >
        <Menu size={ts(22)} strokeWidth={1.8} color={palette.wood} />
      </Pressable>
      <Pressable
        onPress={onBrandPress}
        hitSlop={8}
        style={styles.center}
        accessibilityRole="button"
        accessibilityLabel="Přejít na Domů"
      >
        <BrandMark size="sm" />
      </Pressable>
      <Pressable
        onPress={openSheet}
        hitSlop={8}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `Upozornění, ${unreadCount} nepřečtených` : "Upozornění"}
      >
        <Bell size={ts(21)} strokeWidth={1.8} color={palette.wood} />
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
  iconBtn: { width: ts(34), height: ts(34), alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center" },
  badge: {
    position: "absolute",
    top: 3,
    right: 2,
    minWidth: ts(15),
    height: ts(15),
    borderRadius: radius.pill,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.bg,
  },
  badgeText: { ...type.caption, fontSize: ts(9), lineHeight: ts(10), color: palette.white, fontFamily: "Manrope-Bold" },
});
