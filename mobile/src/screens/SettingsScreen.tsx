import { useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Bug, Check, ChevronRight, Copy, KeyRound, LogOut, Sprout, Trash2 } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { Chip } from "../components/Chip";
import { ChangePasswordSheet } from "../components/ChangePasswordSheet";
import { useLocation } from "../LocationContext";
import { useLocationPicker } from "../LocationPickerContext";
import { useNotifications } from "../NotificationContext";
import { useNotificationPrefs } from "../NotificationPrefsContext";
import { useAuth } from "../AuthContext";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";
import { FALLBACK_ANNUAL_PRICE } from "../subscriptionLimits";
import { SPECIES_BY_ID } from "../speciesInfo";

const ALL_SPECIES = Object.values(SPECIES_BY_ID).sort((a, b) => a.name_cz.localeCompare(b.name_cz, "cs"));
const SUPPORT_EMAIL = "podpora@hriboradar.app";

export default function SettingsScreen() {
  const { location } = useLocation();
  const { openPicker } = useLocationPicker();
  const { watchedSpecies, toggleWatchedSpecies } = useNotifications();
  const { monthlyTipsEnabled, setMonthlyTipsEnabled, terrainSuggestionsEnabled, setTerrainSuggestionsEnabled } =
    useNotificationPrefs();
  const { user, signOut, deleteAccount } = useAuth();
  const { isPremium, loading: subLoading, available, annual, restore } = useSubscription();
  const { openPaywall } = usePaywall();
  const [emailCopied, setEmailCopied] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Google/Apple-only accounts have no password to change - Supabase marks
  // this on the user's identities array (one entry per linked provider),
  // not on app_metadata.provider (which is just "which one they used most
  // recently", not "which ones exist"). Showing the option to an OAuth-only
  // user would just produce a confusing "updateUser" call with no password
  // to actually change against.
  const hasPasswordAuth = user?.identities?.some((i) => i.provider === "email") ?? false;

  async function copySupportEmail() {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

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

  function handleToggleSpecies(id: string) {
    if (!isPremium) {
      openPaywall("Chcete sledovat konkrétní houby a dostávat upozornění na jejich sezónu?");
      return;
    }
    toggleWatchedSpecies(id);
  }

  async function handleRestore() {
    const { error } = await restore();
    if (error) Alert.alert("Nepodařilo se obnovit nákup", error);
    else if (!isPremium) Alert.alert("Nic k obnovení", "K tomuto účtu nejsou žádné dřívější nákupy Hřiboradar Plus.");
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Smazat účet?",
      "Nevratně smažete účet a všechna uložená data - místa, upozornění i historii nálezů. Tuhle akci nejde vzít zpět.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat účet",
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) Alert.alert("Nepodařilo se smazat účet", error);
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen}>
      <PaperBackground style={styles.content}>
      <PageHeader title="Nastavení" />

      <Text style={styles.sectionTitle}>Aktuální poloha</Text>
      {/* Same search/presets/uložená místa picker used everywhere else
          (Domů, Předpověď, Mapa) - having a second, separately-typed-out
          version here previously meant its "Přesné souřadnice" fields
          could silently drift out of sync with the real location whenever
          it changed anywhere else in the app. */}
      <Pressable style={styles.currentCard} onPress={openPicker}>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentLabel}>{location.label}</Text>
          <Text style={styles.currentCoords}>
            {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </Text>
        </View>
        <ChevronRight size={18} strokeWidth={1.8} color={palette.inkFaint} />
      </Pressable>

      <Text style={styles.sectionTitle}>Upozornění</Text>
      <Text style={styles.hint}>
        Upozornění pro jednotlivá uložená místa se zapínají zvonečkem přímo v sekci Moje. Nové posíláme
        nejvýš jednou týdně, ať appka neotravuje.
      </Text>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Měsíční tip</Text>
          <Text style={styles.toggleHint}>Jednou za měsíc krátký houbařský tip, co má zrovna sezónu.</Text>
        </View>
        <Switch
          value={monthlyTipsEnabled}
          onValueChange={setMonthlyTipsEnabled}
          trackColor={{ false: palette.line, true: palette.primary }}
          thumbColor={palette.white}
        />
      </View>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Tipy na sledování</Text>
          <Text style={styles.toggleHint}>
            Když je u uloženého místa hodně stromů, kterým sedí nějaká nesledovaná houba, navrhneme ji přidat.
          </Text>
        </View>
        <Switch
          value={terrainSuggestionsEnabled}
          onValueChange={setTerrainSuggestionsEnabled}
          trackColor={{ false: palette.line, true: palette.primary }}
          thumbColor={palette.white}
        />
      </View>

      <Text style={[styles.hint, { marginTop: space.md }]}>
        Sledované druhy - upozorníme, když jim začíná nebo vrcholí sezóna. Jde zapnout i přímo v detailu
        houby.
      </Text>
      <View style={styles.presetRow}>
        {ALL_SPECIES.map((sp) => (
          <Chip
            key={sp.id}
            label={sp.name_cz}
            active={watchedSpecies.includes(sp.id)}
            onPress={() => handleToggleSpecies(sp.id)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Hřiboradar Plus</Text>
      {isPremium ? (
        <>
          <View style={styles.plusCard}>
            <Sprout size={20} strokeWidth={1.8} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.currentLabel}>Máte Hřiboradar Plus</Text>
              <Text style={styles.toggleHint}>Předpověď na 7 dní, mapa podle druhu, víc uložených míst a sledování hub.</Text>
            </View>
          </View>
          <Pressable onPress={openManageSubscription} hitSlop={6} style={{ marginTop: space.sm, alignSelf: "flex-start" }}>
            <Text style={styles.restoreLink}>Spravovat nebo zrušit předplatné</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={styles.plusCard}
          onPress={() => openPaywall(available ? undefined : "Hřiboradar Plus bude dostupné po další aktualizaci appky.")}
        >
          <Sprout size={20} strokeWidth={1.8} color={palette.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>Přejít na Hřiboradar Plus</Text>
            <Text style={styles.toggleHint}>
              Od {annual?.priceString ?? FALLBACK_ANNUAL_PRICE} / rok - celotýdenní předpověď, mapa podle druhu a
              víc.
            </Text>
          </View>
          <ChevronRight size={18} strokeWidth={1.8} color={palette.inkFaint} />
        </Pressable>
      )}
      {!subLoading && available && (
        <Pressable onPress={handleRestore} hitSlop={6} style={{ marginTop: space.sm, alignSelf: "flex-start" }}>
          <Text style={styles.restoreLink}>Obnovit nákup</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Účet</Text>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>{user?.email ?? "Přihlášeno"}</Text>
      </View>
      {hasPasswordAuth && (
        <Pressable style={styles.changePasswordBtn} onPress={() => setChangingPassword(true)} hitSlop={4}>
          <KeyRound size={16} strokeWidth={1.8} color={palette.ink} />
          <Text style={styles.signOutBtnText}>Změnit heslo</Text>
        </Pressable>
      )}
      <View style={styles.accountActions}>
        <Pressable style={styles.signOutBtn} onPress={signOut} hitSlop={4}>
          <LogOut size={16} strokeWidth={1.8} color={palette.ink} />
          <Text style={styles.signOutBtnText}>Odhlásit se</Text>
        </Pressable>
        <Pressable style={styles.deleteAccountBtn} onPress={confirmDeleteAccount} hitSlop={4}>
          <Trash2 size={16} strokeWidth={1.8} color={palette.danger} />
          <Text style={styles.deleteAccountBtnText}>Smazat účet</Text>
        </Pressable>
      </View>
      {changingPassword && <ChangePasswordSheet onClose={() => setChangingPassword(false)} />}

      <View style={styles.supportRow}>
        <Bug size={16} strokeWidth={1.8} color={palette.inkFaint} />
        <Text style={styles.supportText}>
          Pro podporu nebo nahlášení chyby napište na <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
        </Text>
        <Pressable onPress={copySupportEmail} hitSlop={8} style={styles.copyBtn}>
          {emailCopied ? (
            <Check size={15} strokeWidth={2} color={palette.success} />
          ) : (
            <Copy size={15} strokeWidth={1.8} color={palette.inkFaint} />
          )}
        </Pressable>
      </View>
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  sectionTitle: { ...type.label, color: palette.inkSoft, marginTop: space.xl, marginBottom: space.sm },
  hint: { ...type.caption, color: palette.inkFaint, marginTop: -4, marginBottom: space.sm },
  currentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: space.md,
  },
  currentLabel: { ...type.headingSm, color: palette.ink },
  currentCoords: { ...type.bodySmall, color: palette.inkFaint, marginTop: 2 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  toggleLabel: { ...type.headingSm, color: palette.ink },
  toggleHint: { ...type.caption, color: palette.inkFaint, marginTop: 2, lineHeight: 15 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
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
  restoreLink: { ...type.bodySmall, color: palette.primaryDeep, textDecorationLine: "underline" },
  changePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    marginTop: space.sm,
  },
  accountActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  signOutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
  },
  signOutBtnText: { ...type.bodySmall, color: palette.ink, fontFamily: "Manrope-SemiBold" },
  deleteAccountBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: palette.danger + "14",
    borderWidth: 1,
    borderColor: palette.danger + "33",
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
  },
  deleteAccountBtnText: { ...type.bodySmall, color: palette.danger, fontFamily: "Manrope-SemiBold" },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  supportText: { ...type.caption, color: palette.inkFaint, flex: 1, lineHeight: 15 },
  supportEmail: { color: palette.inkSoft, fontFamily: "Manrope-SemiBold" },
  copyBtn: { padding: 4 },
});
