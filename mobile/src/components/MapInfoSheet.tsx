import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import speciesData from "../data/species.json";

// Same host_trees.length===0 species forecastMath.ts and lib/grid.ts cap in
// the "overall" blend - named here so the cap above isn't just an abstract
// rule but something the user can actually go check on the species chips.
const ALWAYS_POSSIBLE_NAMES = speciesData.species
  .filter((s) => s.host_trees.length === 0)
  .map((s) => s.name_cz)
  .join(", ");

// Explains the two map modes and their honest limits, reachable from the
// "i" button next to the mode chips - added 2026-09-01 so a curious user
// can find out why "Všechny houby" is a blend rather than one clean
// number, instead of just distrusting it.
export function MapInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} maxHeight="80%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Jak funguje mapa</Text>

        <Text style={styles.sectionLabel}>Všechny houby</Text>
        <Text style={styles.body}>
          Vezmeme 3 druhy, které mají na daném místě dnes nejlepší podmínky, a
          spočítáme z nich vážený průměr (nejlepší počítá nejvíc). Ukazuje to,
          jestli je tam dnes vůbec šance najít něco k jídlu - ne jen jeden
          konkrétní druh.
        </Text>
        <Text style={styles.body}>
          Do té trojice smí max. jedna houba, která neroste podle konkrétního
          stromu - jinak by právě tahle skupina snadno ovládla skóre kdekoli,
          protože ji nebrzdí typ lesa v okolí. Patří sem {ALWAYS_POSSIBLE_NAMES}:
          na rozdíl od hřibů nebo lišek na ně obecně bývá vyšší šance skoro
          všude, kde je vlhko a je sezóna.
        </Text>
        <Text style={styles.caveat}>
          Je to odhad podle nejlepší dostupné příležitosti, ne jedno přesné
          číslo pro celý les - na stejném místě mohou mít různé houby úplně
          jinou šanci, tohle jen říká, jestli tam dnes vůbec něco stojí za
          hledání.
        </Text>

        <Text style={styles.sectionLabel}>Jednotlivé houby</Text>
        <Text style={styles.body}>
          Klepnutím na konkrétní druh v liště nahoře uvidíte šanci jen pro
          něj - počítá se z počasí a sezóny a z toho, jestli v okolí reálně
          roste jeho hostitelský strom.
        </Text>

        <Text style={styles.footnote}>
          Čísla jsou odhad z počasí, půdy a sezóny, ne garance nálezu. Model
          se postupně zpřesňuje podle toho, co lidi v appce zapisují.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...type.headingLg, color: palette.ink, marginBottom: space.md },
  sectionLabel: { ...type.label, color: palette.inkFaint, marginTop: space.md, marginBottom: space.xs },
  body: { ...type.body, color: palette.ink, marginBottom: space.sm, lineHeight: 20 },
  caveat: { ...type.bodySmall, color: palette.inkFaint, marginBottom: space.sm, lineHeight: 19 },
  footnote: { ...type.caption, color: palette.inkFaint, marginTop: space.md, lineHeight: 16 },
});
