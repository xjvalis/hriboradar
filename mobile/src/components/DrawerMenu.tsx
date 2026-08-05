import { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { CalendarDays, Home, Leaf, Map, MapPin, Settings, X } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BrandMark } from "./BrandMark";
import type { ScreenName } from "./TopBar";

const ITEMS: { name: ScreenName; Icon: typeof Home; label: string }[] = [
  { name: "Domů", Icon: Home, label: "Domů" },
  { name: "Mapa", Icon: Map, label: "Mapa" },
  { name: "Předpověď", Icon: CalendarDays, label: "Předpověď" },
  { name: "Houby", Icon: Leaf, label: "Houby" },
  { name: "Moje", Icon: MapPin, label: "Moje místa" },
  { name: "Nastavení", Icon: Settings, label: "Nastavení" },
];

// Real botanical line-art (user-supplied reference, mobile/assets/background.png)
// instead of hand-drawn cartoon shapes — sits in the drawer's lower
// (otherwise-empty) half, below the nav list, so it never competes with
// the text for legibility.
const DRAWER_PATTERN = require("../../assets/drawer-pattern.jpg");

export function DrawerMenu({
  visible,
  active,
  onNavigate,
  onClose,
}: {
  visible: boolean;
  active: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(300, width * 0.8);
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -drawerWidth,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, drawerWidth]);

  return (
    <View style={[styles.overlay, { pointerEvents: visible ? "auto" : "none" }]}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <BrandMark size="sm" />
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} strokeWidth={1.8} color={palette.inkFaint} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {ITEMS.map(({ name, Icon, label }) => {
            const isActive = name === active;
            return (
              <Pressable
                key={name}
                onPress={() => onNavigate(name)}
                style={[styles.item, isActive && styles.itemActive]}
              >
                <Icon size={19} strokeWidth={1.8} color={isActive ? palette.primary : palette.wood} />
                <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Image source={DRAWER_PATTERN} resizeMode="repeat" style={styles.art} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.surface,
    borderRightWidth: 1,
    borderRightColor: palette.line,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.surface,
  },
  list: { paddingTop: space.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  itemActive: { backgroundColor: palette.bg },
  itemText: { ...type.body, color: palette.inkSoft },
  itemTextActive: { color: palette.primary, fontFamily: "Manrope-SemiBold" },
  art: {
    flex: 1,
    width: "100%",
    height: "100%",
    opacity: 0.9,
  },
});
