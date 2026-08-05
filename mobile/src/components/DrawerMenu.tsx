import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { Home, Leaf, Map, MapPin, Settings, X } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BrandMark } from "./BrandMark";
import type { ScreenName } from "./TopBar";

const ITEMS: { name: ScreenName; Icon: typeof Home; label: string }[] = [
  { name: "Domů", Icon: Home, label: "Domů" },
  { name: "Mapa", Icon: Map, label: "Mapa" },
  { name: "Houby", Icon: Leaf, label: "Houby" },
  { name: "Moje", Icon: MapPin, label: "Moje místa" },
  { name: "Nastavení", Icon: Settings, label: "Nastavení" },
];

// A few loose mushroom-cap outlines, faint and line-only — decorative, not
// informational, so it stays out of the way of the actual nav list instead
// of competing with it for attention.
function BackgroundArt() {
  return (
    <Svg
      width="100%"
      height={260}
      viewBox="0 0 260 260"
      style={styles.art}
      pointerEvents="none"
    >
      <Path
        d="M40 150 Q40 100 85 100 Q130 100 130 150"
        stroke={palette.line}
        strokeWidth={1.4}
        fill="none"
      />
      <Path d="M60 150 L64 190" stroke={palette.line} strokeWidth={1.4} fill="none" />
      <Path d="M108 150 L104 190" stroke={palette.line} strokeWidth={1.4} fill="none" />
      <Ellipse cx={84} cy={192} rx={22} ry={6} stroke={palette.line} strokeWidth={1.2} fill="none" />

      <Path
        d="M150 210 Q150 165 195 165 Q240 165 240 210"
        stroke={palette.line}
        strokeWidth={1.4}
        fill="none"
      />
      <Path d="M172 210 L175 240" stroke={palette.line} strokeWidth={1.4} fill="none" />
      <Path d="M216 210 L213 240" stroke={palette.line} strokeWidth={1.4} fill="none" />

      <Path
        d="M10 235 Q10 205 38 205 Q66 205 66 235"
        stroke={palette.line}
        strokeWidth={1.2}
        fill="none"
      />
      <Path d="M24 235 L26 255" stroke={palette.line} strokeWidth={1.2} fill="none" />
      <Path d="M52 235 L50 255" stroke={palette.line} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        <BackgroundArt />

        <View style={styles.header}>
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
    backgroundColor: "#1A1710",
    opacity: 0.35,
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
  art: { position: "absolute", left: 0, right: 0, bottom: 0, opacity: 0.5 },
});
