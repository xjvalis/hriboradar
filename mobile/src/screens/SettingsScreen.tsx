import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, ChevronLeft, ChevronRight, MapPin, Sprout } from "lucide-react-native";
import { palette, radius, space, type } from "../theme";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { SettingsLocationSection } from "../components/settings/SettingsLocationSection";
import { SettingsNotificationsSection } from "../components/settings/SettingsNotificationsSection";
import { SettingsPlusSection } from "../components/settings/SettingsPlusSection";
import { SettingsAccountSection } from "../components/settings/SettingsAccountSection";
import { SettingsSupportSection } from "../components/settings/SettingsSupportSection";
import { useLocation } from "../LocationContext";
import { useSubscription } from "../SubscriptionContext";

type Section = "hub" | "location" | "notifications" | "plus";

// Poloha/Upozornění/Plus each carry real configuration (a whole picker, a
// pile of alert types, plan/renewal details) and get their own drill-down
// page. Účet and Podpora are just a handful of plain rows each - forcing
// a tap to reach "sign out" or the support e-mail added a step without
// adding clarity, so those two stay directly on the main screen instead.
export default function SettingsScreen() {
  const [section, setSection] = useState<Section>("hub");
  const { location } = useLocation();
  const { isPremium } = useSubscription();

  const SECTION_META: Record<Exclude<Section, "hub">, { title: string; icon: typeof MapPin; summary?: string; render: () => React.ReactNode }> = {
    location: {
      title: "Poloha",
      icon: MapPin,
      summary: location.label,
      render: () => <SettingsLocationSection onDone={() => setSection("hub")} />,
    },
    notifications: { title: "Upozornění", icon: Bell, render: () => <SettingsNotificationsSection /> },
    plus: {
      title: "Hřiboradar Plus",
      icon: Sprout,
      summary: isPremium ? "Aktivní" : undefined,
      render: () => <SettingsPlusSection />,
    },
  };

  if (section !== "hub") {
    const meta = SECTION_META[section];
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setSection("hub")}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Zpět na Nastavení"
          >
            <ChevronLeft size={22} strokeWidth={2} color={palette.ink} />
          </Pressable>
          <Text style={styles.subHeaderTitle}>{meta.title}</Text>
        </View>
        <ScrollView style={styles.screen}>
          <PaperBackground style={styles.sectionContent}>{meta.render()}</PaperBackground>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      <PaperBackground style={styles.hubContent}>
        <PageHeader title="Nastavení" />
        <View style={styles.hubList}>
          {(Object.keys(SECTION_META) as Exclude<Section, "hub">[]).map((key) => {
            const meta = SECTION_META[key];
            const Icon = meta.icon;
            return (
              <Pressable
                key={key}
                style={styles.hubRow}
                onPress={() => setSection(key)}
                accessibilityRole="button"
                accessibilityLabel={meta.title}
              >
                <Icon size={19} strokeWidth={1.8} color={palette.primary} />
                <Text style={styles.hubRowLabel}>{meta.title}</Text>
                {meta.summary && (
                  <Text style={styles.hubRowSummary} numberOfLines={1}>
                    {meta.summary}
                  </Text>
                )}
                <ChevronRight size={18} strokeWidth={1.8} color={palette.inkFaint} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Účet</Text>
        <SettingsAccountSection />

        <Text style={styles.sectionTitle}>Podpora</Text>
        <SettingsSupportSection />
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hubContent: { paddingBottom: space.xxl },
  hubList: { paddingHorizontal: space.lg, marginTop: space.lg, gap: space.sm },
  hubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  hubRowLabel: { ...type.headingSm, color: palette.ink },
  hubRowSummary: { ...type.bodySmall, color: palette.inkFaint, flex: 1, textAlign: "right" },
  sectionTitle: {
    ...type.label,
    color: palette.inkSoft,
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.bg,
  },
  backBtn: { padding: 2 },
  subHeaderTitle: { ...type.headingMd, color: palette.ink },
  sectionContent: { paddingTop: space.lg, paddingBottom: space.xxl },
});
