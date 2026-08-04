import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { colors, fonts } from "./theme";
import { MapIcon, HomeIcon, BookIcon, PinIcon } from "./icons";

export type ScreenName = "Mapa" | "Domů" | "Atlas" | "Místa";

const NAV: { name: ScreenName; Icon: typeof MapIcon }[] = [
  { name: "Mapa", Icon: MapIcon },
  { name: "Domů", Icon: HomeIcon },
  { name: "Atlas", Icon: BookIcon },
  { name: "Místa", Icon: PinIcon },
];

function LogoMark() {
  return (
    <Svg width={26} height={26} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={22} rx={4} ry={8} fill={colors.inkFaint} />
      <Path d="M4 16 Q16 2 28 16 Q22 21 16 21 Q10 21 4 16 Z" fill={colors.green} />
    </Svg>
  );
}

export function Header({
  active,
  onNavigate,
}: {
  active: ScreenName;
  onNavigate: (screen: ScreenName) => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.brandRow}>
          <LogoMark />
          <View>
            <Text style={styles.brand}>Rostou?</Text>
            <Text style={styles.tagline}>pravděpodobnost růstu</Text>
          </View>
        </View>
        <View style={styles.navIcons}>
          {NAV.map(({ name, Icon }) => {
            const isActive = name === active;
            return (
              <Pressable
                key={name}
                onPress={() => onNavigate(name)}
                style={[styles.navIcon, isActive && styles.navIconActive]}
              >
                <Icon color={isActive ? colors.surface : colors.inkSoft} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.ink, lineHeight: 22 },
  tagline: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 11, color: colors.inkSoft },
  navIcons: { flexDirection: "row", gap: 6 },
  navIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconActive: { backgroundColor: colors.green, borderColor: colors.green },
  rule: { borderTopWidth: 1, borderTopColor: colors.line },
});
