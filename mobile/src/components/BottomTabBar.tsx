import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Home, Leaf, Map } from "lucide-react-native";
import { palette, space, type } from "../theme";
import type { ScreenName } from "./TopBar";

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
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.xs) }]}>
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
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? palette.primary : palette.inkFaint} />
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
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bg,
    paddingTop: space.xs,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 2 },
  label: { ...type.caption, fontSize: 10, color: palette.inkFaint },
  labelActive: { color: palette.primary, fontFamily: "Manrope-SemiBold" },
});
