import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { LocationSearchInput } from "../components/LocationSearchInput";
import { useLocation, PRESET_LOCATIONS } from "../LocationContext";

export default function SettingsScreen() {
  const { location, setLocation } = useLocation();
  const [lat, setLat] = useState(String(location.lat));
  const [lon, setLon] = useState(String(location.lon));
  const [label, setLabel] = useState("Vlastní poloha");

  function applyCustom() {
    const latNum = parseFloat(lat.replace(",", "."));
    const lonNum = parseFloat(lon.replace(",", "."));
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;
    setLocation({ lat: latNum, lon: lonNum, label: label || "Vlastní poloha" });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader eyebrow="appka počítá pro" title="Nastavení" />

      <Text style={styles.sectionTitle}>Aktuální poloha</Text>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>{location.label}</Text>
        <Text style={styles.currentCoords}>
          {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Hledat místo</Text>
      <LocationSearchInput
        onSelect={(r) => setLocation({ lat: r.lat, lon: r.lon, label: r.label })}
      />

      <Text style={styles.sectionTitle}>Rychlá volba</Text>
      <View style={styles.presetRow}>
        {PRESET_LOCATIONS.map((preset) => {
          const isActive = preset.lat === location.lat && preset.lon === location.lon;
          return (
            <Pressable
              key={preset.label}
              onPress={() => setLocation(preset)}
              style={[styles.preset, isActive && styles.presetActive]}
            >
              <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Přesné souřadnice</Text>
      <Text style={styles.hint}>Pro místa bez jména na mapě — třeba oblíbený les.</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Název místa (např. Chalupa)"
          placeholderTextColor={palette.inkFaint}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={lat}
            onChangeText={setLat}
            placeholder="Zeměpisná šířka"
            placeholderTextColor={palette.inkFaint}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={lon}
            onChangeText={setLon}
            placeholder="Zeměpisná délka"
            placeholderTextColor={palette.inkFaint}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <PrimaryButton label="Nastavit polohu" onPress={applyCustom} />
      </View>

      <Text style={styles.note}>
        Appka zatím nepoužívá GPS zařízení — poloha se zadává ručně. Vhodné pro
        testování z libovolného místa, i pro plánování výletu předem.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  sectionTitle: { ...type.label, color: palette.inkSoft, marginTop: space.xl, marginBottom: space.sm },
  hint: { ...type.caption, color: palette.inkFaint, marginTop: -4, marginBottom: space.sm },
  currentCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
  },
  currentLabel: { ...type.headingSm, color: palette.ink },
  currentCoords: { ...type.bodySmall, color: palette.inkFaint, marginTop: 2 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  preset: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: palette.surface,
  },
  presetActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  presetText: { ...type.bodySmall, color: palette.inkSoft },
  presetTextActive: { color: palette.white, fontFamily: "Manrope-SemiBold" },
  form: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: palette.ink,
  },
  note: { ...type.caption, color: palette.inkFaint, marginTop: space.xl, lineHeight: 16 },
});
