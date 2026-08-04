import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line, Polygon, G } from "react-native-svg";
import { colors, fonts } from "./theme";

/**
 * Decorative placeholder for the real map (that's the next build phase —
 * a live grid of scored points). This keeps the home screen's layout and
 * mood matching the approved mockup: soft probability "clouds" over a
 * sketched terrain, not a literal functioning map yet.
 */
export function MapCard() {
  return (
    <View style={styles.wrap}>
      <Svg viewBox="0 0 308 200" width="100%" height={190}>
        <Path d="M-10 40 Q60 20 100 45 T220 30 T320 55" stroke={colors.line} strokeWidth={1} fill="none" />
        <Path d="M-10 90 Q80 70 140 92 T320 78" stroke={colors.line} strokeWidth={1} fill="none" />
        <Path d="M-10 150 Q90 130 150 155 T320 140" stroke={colors.line} strokeWidth={1} fill="none" />

        <G opacity={0.5}>
          <Circle cx={196} cy={62} r={20} fill={colors.scoreGood} opacity={0.4} />
          <Circle cx={228} cy={70} r={26} fill={colors.scoreMedium} opacity={0.35} />
          <Circle cx={150} cy={88} r={17} fill={colors.scoreMedium} opacity={0.35} />
          <Circle cx={74} cy={118} r={22} fill={colors.scoreGood} opacity={0.4} />
          <Circle cx={104} cy={130} r={15} fill={colors.scorePoor} opacity={0.35} />
          <Circle cx={252} cy={140} r={24} fill={colors.scoreGood} opacity={0.4} />
        </G>

        <G stroke={colors.green} strokeWidth={1.4} fill={colors.green}>
          <Line x1={150} y1={96} x2={150} y2={70} />
          <Polygon points="150,70 166,74 150,78" />
        </G>
      </Svg>
      <View style={styles.captionRow}>
        <Text style={styles.caption}>Barevné oblaky = pravděpodobnost růstu</Text>
        <Text style={styles.link}>Otevřít mapu →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginTop: 12,
  },
  captionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  caption: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkFaint, flex: 1 },
  link: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.green },
});
