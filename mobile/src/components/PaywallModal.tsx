import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { PrimaryButton } from "./PrimaryButton";
import { usePaywall } from "../PaywallContext";
import { useSubscription, type BillingPeriod } from "../SubscriptionContext";
import {
  FALLBACK_MONTHLY_PRICE,
  FALLBACK_ANNUAL_PRICE,
  FALLBACK_MONTHLY_PRICE_CZK,
  FALLBACK_ANNUAL_PRICE_CZK,
} from "../subscriptionLimits";

const FEATURES = [
  "Neomezený počet uložených míst",
  "Předpověď na 7 dní dopředu",
  "Podrobný rozpad podle konkrétní houby",
  "Sledování hub a chytrá upozornění na sezónu",
];

// Badge always compares the two Kč fallback prices, even once a real
// RevenueCat offering loads - the % saved by committing to a year is a
// fixed fact of how the two products are priced, not something that
// should flicker based on which currency/region string just came back.
const ANNUAL_SAVINGS_PCT = Math.round((1 - FALLBACK_ANNUAL_PRICE_CZK / (FALLBACK_MONTHLY_PRICE_CZK * 12)) * 100);

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
  const { isPremium, available, monthly, annual, purchase, restore } = useSubscription();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
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

  const monthlyPrice = monthly?.priceString ?? FALLBACK_MONTHLY_PRICE;
  const annualPrice = annual?.priceString ?? FALLBACK_ANNUAL_PRICE;

  async function handlePurchase() {
    setPurchasing(true);
    const { error } = await purchase(period);
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
          <Sparkles size={ts(22)} strokeWidth={2} color={palette.accent} />
        </View>
        <Text style={styles.title}>Hřiboradar Plus</Text>
        {reason && <Text style={styles.reason}>{reason}</Text>}

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Check size={ts(16)} strokeWidth={2.4} color={palette.success} />
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
            <View style={styles.periodRow}>
              <Pressable
                style={[styles.periodCard, period === "monthly" && styles.periodCardActive]}
                onPress={() => setPeriod("monthly")}
              >
                <Text style={[styles.periodLabel, period === "monthly" && styles.periodLabelActive]}>Měsíčně</Text>
                <Text style={[styles.periodPrice, period === "monthly" && styles.periodPriceActive]}>
                  {monthlyPrice}
                </Text>
                <Text style={[styles.periodSub, period === "monthly" && styles.periodSubActive]}>za měsíc</Text>
              </Pressable>
              <Pressable
                style={[styles.periodCard, period === "annual" && styles.periodCardActive]}
                onPress={() => setPeriod("annual")}
              >
                {ANNUAL_SAVINGS_PCT > 0 && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>ušetříte {ANNUAL_SAVINGS_PCT} %</Text>
                  </View>
                )}
                <Text style={[styles.periodLabel, period === "annual" && styles.periodLabelActive]}>Ročně</Text>
                <Text style={[styles.periodPrice, period === "annual" && styles.periodPriceActive]}>
                  {annualPrice}
                </Text>
                <Text style={[styles.periodSub, period === "annual" && styles.periodSubActive]}>za rok</Text>
              </Pressable>
            </View>
            <PrimaryButton label="Aktivovat Hřiboradar Plus" onPress={handlePurchase} loading={purchasing} />
            <Text onPress={handleRestore} style={styles.restoreLink}>
              {restoring ? "Obnovuji…" : "Už jsem si koupil(a) - obnovit nákup"}
            </Text>
          </>
        )}

        <Text style={styles.legal}>
          Předplatné se automaticky obnovuje, dokud ho nezrušíte - zrušit jde kdykoli ve správě
          předplatných App Store / Google Play. Nákupem souhlasíte s{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://hriboradar.app/terms.html")}>
            podmínkami užití
          </Text>{" "}
          a{" "}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL("https://hriboradar.app/privacy.html")}
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
    width: ts(44),
    height: ts(44),
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
  periodRow: { flexDirection: "row", gap: space.sm, alignSelf: "stretch", marginBottom: space.md },
  periodCard: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  periodCardActive: { borderColor: palette.primary, backgroundColor: palette.primary + "0d" },
  periodLabel: { ...type.label, color: palette.inkSoft },
  periodLabelActive: { color: palette.primaryDeep },
  periodPrice: { ...type.headingLg, color: palette.ink, marginTop: 4 },
  periodPriceActive: { color: palette.ink },
  periodSub: { ...type.caption, color: palette.inkFaint, marginTop: 2 },
  periodSubActive: { color: palette.inkSoft },
  savingsBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  savingsBadgeText: { ...type.caption, fontSize: ts(10), color: palette.white, fontFamily: "Manrope-Bold" },
  unavailable: { ...type.bodySmall, color: palette.inkFaint, textAlign: "center", marginVertical: space.md },
  restoreLink: { ...type.caption, color: palette.primary, marginTop: space.md, textAlign: "center" },
  legal: { ...type.caption, color: palette.inkFaint, textAlign: "center", marginTop: space.xl, lineHeight: 16 },
  legalLink: { color: palette.primary, textDecorationLine: "underline" },
});
