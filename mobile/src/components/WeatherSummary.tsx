import { StyleSheet, Text, View } from "react-native";
import { CloudRain, Droplets, Thermometer } from "lucide-react-native";
import { Card } from "./Card";
import { palette, space, type } from "../theme";

export function WeatherSummary({
  tempC,
  soilMoisturePct,
  daysSinceRain,
  tempLabel = "Teplota",
}: {
  tempC: number;
  soilMoisturePct: number;
  daysSinceRain: number | null;
  /** Defaults to "Teplota" (implying "right now") — pass an explicit label
   * like "Průměrná denní teplota" whenever tempC is a day average rather
   * than a live reading, so it doesn't misrepresent itself. */
  tempLabel?: string;
}) {
  const items = [
    { Icon: Thermometer, label: tempLabel, value: `${Math.round(tempC)} °C` },
    { Icon: Droplets, label: "Vlhkost půdy", value: `${Math.round(soilMoisturePct)} %` },
    {
      Icon: CloudRain,
      label: "Od deště",
      value: daysSinceRain == null ? "dávno" : `${daysSinceRain} dní`,
    },
  ];
  return (
    <Card style={styles.row}>
      {items.map(({ Icon, label, value }) => (
        <View key={label} style={styles.item}>
          <Icon size={18} strokeWidth={1.6} color={palette.secondary} />
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-around", paddingVertical: space.base },
  item: { alignItems: "center", gap: 4 },
  value: { ...type.headingSm, color: palette.ink },
  label: { ...type.caption, color: palette.inkFaint },
});
