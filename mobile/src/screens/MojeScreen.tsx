import { StyleSheet, Text, View } from "react-native";
import { Sprout } from "lucide-react-native";
import { palette, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";

export default function MojeScreen() {
  return (
    <View style={styles.screen}>
      <PageHeader eyebrow="chalupa, revír, les" title="Moje" subtitle="0 uložených míst" />
      <EmptyState
        icon={Sprout}
        title="Zatím nemáte žádná uložená místa."
        description="Přidejte chalupu, revír nebo oblíbené houbařské místo a sledujte pravděpodobnost růstu hub."
        action={
          <View style={{ marginTop: space.lg, alignItems: "center", gap: space.sm }}>
            <PrimaryButton label="Přidat první místo" disabled />
            <Text style={styles.note}>(zatím bez ukládání — přijde s notifikacemi)</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  note: { ...type.caption, color: palette.inkFaint },
});
