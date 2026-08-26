import { useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { PrimaryButton } from "./PrimaryButton";
import { usePaywall } from "../PaywallContext";
import { useSubscription } from "../SubscriptionContext";

const FEATURES = [
  "Neomezený počet uložených míst",
  "Předpověď na 7 dní dopředu",
  "Podrobný rozpad podle konkrétní houby",
  "Sledování hub a chytrá upozornění na sezónu",
];

// Apple's subscription guidelines (3.1.2) require the paywall itself to
// show the subscription's title, length, and price before purchase, plus
// working links to Terms of Use and Privacy Policy - all present below,
// not just in App Store Connect's own listing. Rendered once at the app
// shell's top level (same pattern as every other global sheet - see
// NotificationsSheet/LocationPickerSheet) and opened via
// usePaywall().openPaywall(reason) from wherever a free user hits a
// gated feature.
export function PaywallModal() {
  const { isOpen, reason, closePaywall } = usePaywall();
  const { isPremium, available, offeringPriceString, purchase, restore } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (!isOpen) return null;

  // A purchase (or a restore that finds an active one) flips isPremium via
  // the customer-info listener in SubscriptionContext - closing here once
  // it's true means the sheet dismisses itself right after either
  // succeeds, without needing its own separate "done" state.
  if (isPremium) {
    closePaywall();
    return null;
  }

  async function handlePurchase() {
    setPurchasing(true);
    const { error } = await purchase();
    setPurchasing(false);
    if (error) Alert.alert("Nákup se nezdařil", error);
  }

  async function handleRestore() {
    setRestoring(true);
    const { error } = await restore();
    setRestoring(false);
    if (error) Alert.alert("Obnovení se nezdařilo", error);
    else Alert.alert("Hotovo", "Žádné aktivní předplatné jsme nenašli.");
  }

  return (
    <BottomSheet onClose={closePaywall} maxHeight="90%">
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Sparkles size={22} strokeWidth={2} color={palette.accent} />
        </View>
        <Text style={styles.title}>Rostou? Plus</Text>
        {reason && <Text style={styles.reason}>{reason}</Text>}

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Check size={16} strokeWidth={2.4} color={palette.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {!available ? (
          <Text style={styles.unavailable}>
            Předplatné bude dostupné po další aktualizaci appky.
          </Text>
        ) : (
          <>
            <Text style={styles.price}>{offeringPriceString ?? "99 Kč"} / měsíc</Text>
            <PrimaryButton label="Aktivovat Rostou? Plus" onPress={handlePurchase} loading={purchasing} />
            <Text onPress={handleRestore} style={styles.restoreLink}>
              {restoring ? "Obnovuji…" : "Už jsem si koupil(a) - obnovit nákup"}
            </Text>
          </>
        )}

        <Text style={styles.legal}>
          Předplatné se automaticky obnovuje, dokud ho nezrušíte - zrušit jde kdykoli ve správě
          předplatných App Store / Google Play. Nákupem souhlasíte s{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://rostou-delta.vercel.app/terms.html")}>
            podmínkami užití
          </Text>{" "}
          a{" "}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL("https://rostou-delta.vercel.app/privacy.html")}
          >
            zásadami ochrany osobních údajů
          </Text>
          .
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xl, alignItems: "center" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.accent + "1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  title: { ...type.headingLg, color: palette.ink },
  reason: { ...type.bodySmall, color: palette.inkSoft, textAlign: "center", marginTop: 4, paddingHorizontal: space.md },
  featureList: { alignSelf: "stretch", gap: space.sm, marginTop: space.lg, marginBottom: space.lg },
  featureRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  featureText: { ...type.body, color: palette.ink, flexShrink: 1 },
  price: { ...type.displayLg, fontSize: 22, color: palette.ink, marginBottom: space.sm },
  unavailable: { ...type.bodySmall, color: palette.inkFaint, textAlign: "center", marginVertical: space.md },
  restoreLink: { ...type.caption, color: palette.primary, marginTop: space.md, textAlign: "center" },
  legal: { ...type.caption, color: palette.inkFaint, textAlign: "center", marginTop: space.xl, lineHeight: 16 },
  legalLink: { color: palette.primary, textDecorationLine: "underline" },
});
