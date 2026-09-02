import { StyleSheet, Text, View } from "react-native";
import { palette, radius, ts, type } from "../theme";

// Compact "which months does this grow in" strip for atlas cards - 12 small
// bars, in-season ones lit up (peak months brighter than shoulder months),
// with "1"/"12" printed under the end bars so it reads as a year at a
// glance instead of an abstract barcode.
export function SeasonSparkline({
  seasonMonths,
  peakMonths,
}: {
  seasonMonths: number[];
  peakMonths?: number[];
}) {
  const season = new Set(seasonMonths);
  const peak = new Set(peakMonths ?? []);

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const isPeak = peak.has(month);
          const inSeason = season.has(month);
          return (
            <View
              key={month}
              style={[
                styles.bar,
                inSeason && { backgroundColor: isPeak ? palette.primary : palette.secondary },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>1</Text>
        <Text style={styles.labelText}>12</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  bars: { flexDirection: "row", gap: 2.5 },
  bar: {
    flex: 1,
    height: ts(5),
    borderRadius: radius.sm,
    backgroundColor: palette.line,
  },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  labelText: { ...type.caption, fontSize: ts(9), lineHeight: ts(11), color: palette.inkFaint },
});
