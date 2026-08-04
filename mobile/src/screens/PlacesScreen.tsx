import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../theme";

export default function PlacesScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>chalupa, revír, les</Text>
          <Text style={styles.title}>Moje místa</Text>
          <Text style={styles.subtitle}>0 uložených míst</Text>
        </View>
      </View>

      <View style={styles.empty}>
        <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={colors.inkFaint} strokeWidth={1.5}>
          <Path d="M12 21c4-1 6-4 6-8a6 6 0 0 0-12 0c0 4 2 7 6 8Z" />
          <Path d="M12 13V4M12 4 8 7M12 7l4-3" />
        </Svg>
        <Text style={styles.emptyTitle}>Zatím nemáte žádná uložená místa.</Text>
        <Text style={styles.emptyText}>
          Přidejte chalupu, revír nebo oblíbené houbařské místo a sledujte
          pravděpodobnost růstu hub.
        </Text>
        <Pressable style={styles.button} disabled>
          <Text style={styles.buttonText}>+ Přidat první místo</Text>
        </Pressable>
        <Text style={styles.note}>(zatím bez ukládání — přijde s notifikacemi)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  eyebrow: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 13, color: colors.inkSoft },
  title: { fontFamily: fonts.serifBold, fontSize: 23, color: colors.ink, marginTop: 2 },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
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
  button: {
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 18,
    opacity: 0.5,
  },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 13, color: "#fff" },
  note: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.inkFaint, marginTop: 8 },
});
