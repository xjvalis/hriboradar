import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Ellipse, G, Path } from "react-native-svg";
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

// Bold, filled mushroom silhouettes in the drawer's lower (otherwise-empty)
// half — meant to read like a jacket lining: a real flash of color and
// pattern, not a decorative afterthought. Sits entirely below the nav list
// so it never fights with the text for legibility; the original thin gray
// line-art version read as barely-there rather than playful.
const MUSHROOM_COLORS = [palette.accent, palette.primary, palette.secondary];

function Mushroom({
  x,
  y,
  scale = 1,
  rotate = 0,
  color,
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  color: string;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Path d="M-38 0 C-38 -34 38 -34 38 0 C 20 10 -20 10 -38 0 Z" fill={color} />
      <Path d="M-16 4 L-11 46 Q0 52 11 46 L16 4 Z" fill={palette.surface} stroke={color} strokeWidth={1.5} />
      <Ellipse cx={-14} cy={-16} rx={5} ry={4} fill={palette.surface} opacity={0.55} />
      <Ellipse cx={10} cy={-22} rx={4} ry={3} fill={palette.surface} opacity={0.5} />
      <Ellipse cx={18} cy={-10} rx={3.5} ry={3} fill={palette.surface} opacity={0.5} />
    </G>
  );
}

function BackgroundArt() {
  return (
    <Svg
      width="100%"
      height={360}
      viewBox="0 0 300 360"
      style={styles.art}
      pointerEvents="none"
    >
      <Mushroom x={55} y={90} scale={1.15} rotate={-8} color={MUSHROOM_COLORS[0]} />
      <Mushroom x={215} y={150} scale={0.85} rotate={10} color={MUSHROOM_COLORS[1]} />
      <Mushroom x={40} y={250} scale={0.7} rotate={6} color={MUSHROOM_COLORS[2]} />
      <Mushroom x={225} y={300} scale={1.05} rotate={-6} color={MUSHROOM_COLORS[0]} />
      <Mushroom x={120} y={320} scale={0.6} rotate={14} color={MUSHROOM_COLORS[1]} />

      <Path d="M0 360 Q75 335 150 355 T300 350 L300 360 Z" fill={palette.primary} opacity={0.16} />
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        <BackgroundArt />

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
  art: { position: "absolute", left: 0, right: 0, bottom: 0, opacity: 0.85 },
});
