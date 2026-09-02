import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Sprout } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../../theme";
import { useSubscription } from "../../SubscriptionContext";
import { usePaywall } from "../../PaywallContext";
import { FALLBACK_ANNUAL_PRICE, FALLBACK_MONTHLY_PRICE_CZK, FALLBACK_ANNUAL_PRICE_CZK } from "../../subscriptionLimits";

// Product identifiers match SubscriptionContext.tsx's findPackage() custom
// ids ("monthly"/"yearly") - RevenueCat's own productIdentifier is the App
// Store Connect product id instead (hriboradar_plus_monthly/_annual), so
// this checks by substring rather than an exact match against either
// naming scheme.
function planLabel(productIdentifier: string): string {
  if (productIdentifier.toLowerCase().includes("annual") || productIdentifier.toLowerCase().includes("yearly")) {
    return "Roční plán";
  }
  if (productIdentifier.toLowerCase().includes("monthly")) return "Měsíční plán";
  return "Hřiboradar Plus";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

export function SettingsPlusSection() {
  const { isPremium, loading, available, annual, activeEntitlement, restore } = useSubscription();
  const { openPaywall } = usePaywall();

  // Apple requires a way to manage/cancel a subscription reachable from
  // inside the app (guideline 3.1.2) - it doesn't have to be a custom
  // screen, a link straight to the platform's own subscription management
  // is the standard, Apple-recommended approach (they manage billing, not
  // us - RevenueCat mirrors status, it doesn't own cancellation).
  function openManageSubscription() {
    const url =
      Platform.OS === "ios"
        ? "itms-apps://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions?package=cz.hriboradar.app";
    Linking.openURL(url).catch(() => {});
  }

  async function handleRestore() {
    const { error } = await restore();
    if (error) Alert.alert("Nepodařilo se obnovit nákup", error);
    else if (!isPremium) Alert.alert("Nic k obnovení", "K tomuto účtu nejsou žádné dřívější nákupy Hřiboradar Plus.");
  }

  return (
    <View style={styles.padded}>
      {loading ? (
        // Genuinely unknown yet, not "free" - RevenueCat's customer info is
        // one more network round-trip on every cold start, and isPremium
        // defaults to false until it resolves. Rendering the free-upsell
        // card here (as this used to) meant a real Plus subscriber saw
        // "Přejít na Plus" flash on screen on every single app open, not
        // just a fresh install (found 2026-09-02 - the fresh-install case
        // is a separate race fixed in SubscriptionContext.tsx, but this
        // brief loading window exists on every launch regardless).
        <View style={[styles.plusCard, styles.plusCardLoading]}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.toggleHint}>Načítám předplatné…</Text>
        </View>
      ) : isPremium ? (
        <>
          <View style={styles.plusCard}>
            <Sprout size={ts(20)} strokeWidth={1.8} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.currentLabel}>
                {activeEntitlement ? planLabel(activeEntitlement.productIdentifier) : "Máte Hřiboradar Plus"}
              </Text>
              <Text style={styles.toggleHint}>
                Předpověď na 7 dní, mapa podle druhu, víc uložených míst a sledování hub.
              </Text>
              {activeEntitlement?.expirationDate && (
                <Text style={styles.renewalText}>
                  {activeEntitlement.willRenew ? "Obnoví se " : "Platnost končí "}
                  {formatDate(activeEntitlement.expirationDate)}
                </Text>
              )}
            </View>
          </View>
          <Pressable onPress={openManageSubscription} hitSlop={6} style={styles.linkBtn}>
            <Text style={styles.restoreLink}>Spravovat nebo zrušit předplatné</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={styles.plusCard}
          onPress={() => openPaywall(available ? undefined : "Hřiboradar Plus bude dostupné po další aktualizaci appky.")}
        >
          <Sprout size={ts(20)} strokeWidth={1.8} color={palette.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>Přejít na Hřiboradar Plus</Text>
            <Text style={styles.toggleHint}>
              Od {annual?.priceString ?? FALLBACK_ANNUAL_PRICE} / rok - celotýdenní předpověď, mapa podle druhu a
              víc.
            </Text>
          </View>
        </Pressable>
      )}
      {!loading && available && (
        <Pressable onPress={handleRestore} hitSlop={6} style={styles.linkBtn}>
          <Text style={styles.restoreLink}>Obnovit nákup</Text>
        </Pressable>
      )}
      <Text style={styles.priceNote}>
        Ceny: {FALLBACK_MONTHLY_PRICE_CZK} Kč měsíčně nebo {FALLBACK_ANNUAL_PRICE_CZK} Kč ročně (přesná cena a
        měna podle vašeho App Store / Google Play účtu).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.lg },
  plusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  plusCardLoading: { justifyContent: "center" },
  currentLabel: { ...type.headingSm, color: palette.ink },
  toggleHint: { ...type.caption, color: palette.inkFaint, marginTop: 2, lineHeight: 15 },
  renewalText: { ...type.caption, color: palette.primaryDeep, marginTop: 6, fontFamily: "Manrope-SemiBold" },
  linkBtn: { marginTop: space.sm, alignSelf: "flex-start" },
  restoreLink: { ...type.bodySmall, color: palette.primaryDeep, textDecorationLine: "underline" },
  priceNote: { ...type.caption, color: palette.inkFaint, marginTop: space.lg, lineHeight: 15 },
});
