import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { PageHeader } from "./PageHeader";
import { PaperBackground } from "./PaperBackground";
import { useAboutScreen } from "../AboutScreenContext";

const FACTORS = [
  "Meteorologická předpověď a historie počasí - teplota, srážky, vlhkost půdy, dny od posledního deště",
  "Polygony skutečných lesů celé ČR - ne hrubá mřížka, ale přesné tvary lesních ploch",
  "Druhové složení lesa - jaké stromy tam rostou, protože spousta hub roste jen u určitých druhů",
  "Sezónní data - kdy který druh houby reálně roste",
  "Dlouhodobá vodní bilance - jestli krajina v posledních týdnech spíš vysychala, nebo měla dost vláhy",
];

export function AboutScreen() {
  const { isOpen, closeAbout } = useAboutScreen();
  if (!isOpen) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={closeAbout} hitSlop={8} style={styles.headerBtn}>
            <X size={ts(20)} strokeWidth={2} color={palette.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <PaperBackground style={styles.content}>
            <PageHeader eyebrow="hřiboradar" title="O aplikaci" />

            <View style={styles.padded}>
              <Text style={styles.paragraph}>
                Hřiboradar slouží jako pomocník pro houbaře všech úrovní. Zkušený houbař si může
                naplánovat vlastní tour po místech, kde má největší šanci najít vzácné druhy. Rodina
                zase víkendový výlet do lesa, kde je větší šance, že košík nezůstane prázdný. A
                začínající houbař může díky Hřiboradaru nejen vyrazit na své první hříbky, ale
                postupně se naučit sbírat i další druhy a dozvídat se o nich něco nového.
              </Text>

              <Text style={styles.heading}>Jak to počítáme?</Text>
              <Text style={styles.paragraph}>
                Houbový index nestaví na dojmech - táhneme reálná data z několika datasetů najednou
                a skládáme je dohromady:
              </Text>
              <View style={styles.list}>
                {FACTORS.map((f) => (
                  <View key={f} style={styles.listRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.listText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.paragraph}>
                Tohle všechno appka pro každé místo a každý druh zkombinuje do jednoho čísla od 0 do
                100.
              </Text>

              <Text style={styles.heading}>Jak přesný je houbový index?</Text>
              <Text style={styles.paragraph}>
                Je to solidní, propracovaný model, ne odhad od oka - a s reálnými daty se navíc
                postupně zpřesňuje. Přesto žádná houba neroste podle vzorečku na 100 %: počasí je
                nevyzpytatelné a les taky. Čím víc faktorů sedí, tím vyšší index appka ukáže, ale
                vysoké číslo není záruka, že se domů vrátíte s plným košíkem - je to spolehlivý
                základ pro to, kam a kdy se vyplatí vyrazit. A pak už začíná to nejlepší - samotné
                hledání.
              </Text>
            </View>
          </PaperBackground>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  headerBtn: { alignSelf: "flex-start", padding: space.xs },
  content: { paddingBottom: space.xxl },
  padded: { paddingHorizontal: space.lg },
  heading: { ...type.headingMd, color: palette.ink, marginTop: space.lg, marginBottom: space.xs },
  paragraph: { ...type.body, color: palette.inkSoft, marginTop: space.sm },
  list: { marginTop: space.sm, gap: space.sm },
  listRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    marginTop: 8,
  },
  listText: { ...type.body, color: palette.inkSoft, flex: 1 },
});
