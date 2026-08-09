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

// One piece cut straight from the user's reference sheet (mobile/assets/
// background.png) rather than several hand-placed cutouts — every prior
// attempt at compositing individual sprites kept producing overlaps or
// edge artifacts. This is a single rectangular region auto-selected so
// no mushroom's linework touches its boundary (nothing is ever mid-cut),
// with its flat paper background chroma-keyed to transparent so it blends
// straight into the drawer's own surface color instead of showing a
// mismatched panel underneath.
const MUSHROOM_SHEET = require("../../assets/mushroom-sheet.png");
const MUSHROOM_SHEET_ASPECT = 878 / 1019; // width / height

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
  // Computed explicitly rather than via the `aspectRatio` style — that
  // style didn't constrain height on web here and the image rendered at
  // its full natural size instead of scaling down with its width.
  const artWidth = drawerWidth * 0.9;
  const artHeight = artWidth / MUSHROOM_SHEET_ASPECT;
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
        <View style={styles.backdropTint} />
        <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
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

        <View style={styles.art}>
          <Image
            source={MUSHROOM_SHEET}
            resizeMode="contain"
            style={{ width: artWidth, height: artHeight, opacity: 0.45 }}
          />
        </View>
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
  // Belt-and-braces with BlurView: if the native blur effect doesn't
  // render for any reason, this still dims/softens the page behind
  // instead of leaving it fully sharp and undimmed.
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.surface,
    opacity: 0.4,
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
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: space.md,
  },
});
