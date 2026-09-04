import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Home, Leaf, Map } from "lucide-react-native";
import { IS_TABLET, palette, space, type } from "../theme";
import type { ScreenName } from "./TopBar";

// The flat 1.2x FONT_SCALE (ts(), used everywhere else) still left this
// bar reading as tiny against a 13" iPad's sheer size - found 2026-09-05
// ("dolní menu je hrozně malé"). Sized directly per platform here instead
// of stacking another multiplier on top of ts().
const ICON_SIZE = IS_TABLET ? 28 : 22;
const LABEL_SIZE = IS_TABLET ? 14 : 10;

// The 4 screens someone actually reaches for daily - "is it worth going
// out today" (Domů), "where exactly" (Mapa), "what about this week"
// (Předpověď), "what's in season" (Houby). Moje/Nastavení stay behind the
// hamburger drawer - occasional/setup actions, not daily-glance ones, so
// they don't need to cost a thumb-reach on every screen. Previously
// everything (including these 4) lived one drawer-tap away, which was
// needless friction for the screens actually used every single day.
const TABS: { name: ScreenName; Icon: typeof Home; label: string }[] = [
  { name: "Domů", Icon: Home, label: "Domů" },
  { name: "Mapa", Icon: Map, label: "Mapa" },
  { name: "Předpověď", Icon: CalendarDays, label: "Předpověď" },
  { name: "Houby", Icon: Leaf, label: "Houby" },
];

export function BottomTabBar({ active, onNavigate }: { active: ScreenName; onNavigate: (screen: ScreenName) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, space.xs) }]}>
      <View style={styles.bar}>
        {TABS.map(({ name, Icon, label }) => {
          const isActive = name === active;
          return (
            <Pressable
              key={name}
              onPress={() => onNavigate(name)}
              style={styles.tab}
              hitSlop={4}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <Icon size={ICON_SIZE} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? palette.primary : palette.inkFaint} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// 4 icons spread with flex:1 across a full iPad-width bar leaves huge dead
// gaps between them - capping and centering the row (same idea as
// PaperBackground's reading-width column) keeps the tabs a comfortable
// thumb-reach apart instead of spread thin across the whole screen.
// Narrower than PaperBackground's 640 (text) since this is just 4 icons,
// not a reading column - phone is untouched (IS_TABLET false there).
const TABLET_BAR_MAX_WIDTH = 480;

const styles = StyleSheet.create({
  barOuter: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bg,
    paddingTop: space.xs,
    alignItems: IS_TABLET ? "center" : undefined,
  },
  bar: IS_TABLET
    ? { flexDirection: "row", width: "100%", maxWidth: TABLET_BAR_MAX_WIDTH }
    : { flexDirection: "row" },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: IS_TABLET ? 4 : 2,
    paddingVertical: IS_TABLET ? 6 : 2,
  },
  label: { ...type.caption, fontSize: LABEL_SIZE, color: palette.inkFaint },
  labelActive: { color: palette.primary, fontFamily: "Manrope-SemiBold" },
});
