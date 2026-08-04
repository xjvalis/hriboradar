import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../theme";

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>celá ČR</Text>
        <Text style={styles.title}>Mapa</Text>
      </View>
      <View style={styles.empty}>
        <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={colors.inkFaint} strokeWidth={1.5}>
          <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
          <Path d="M9 4v14M15 6v14" />
        </Svg>
        <Text style={styles.emptyTitle}>Mapa se připravuje.</Text>
        <Text style={styles.emptyText}>
          `/api/forecast` zatím počítá jeden bod na dotaz. Mapa s barevnými
          oblastmi po celé ČR potřebuje grid — to je další krok.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 8 },
  eyebrow: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 13, color: colors.inkSoft },
  title: { fontFamily: fonts.serifBold, fontSize: 23, color: colors.ink, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, marginTop: 16, textAlign: "center" },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
});
