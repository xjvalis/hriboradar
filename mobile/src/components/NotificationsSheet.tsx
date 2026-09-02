import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, Leaf, MapPin, Sparkles, PlusCircle } from "lucide-react-native";
import { palette, radius, space, ts, type } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { useNotifications, type AppNotification } from "../NotificationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { useAppNavigation } from "../AppNavigationContext";
import { useSpeciesDetail } from "../SpeciesDetailContext";
import { useLocation } from "../LocationContext";
import { resolveNotificationAction } from "../notificationActions";

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "dnes";
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  return `před ${Math.floor(days / 7)} týdny`;
}

const KIND_ICON: Record<AppNotification["kind"], typeof Bell> = {
  species: Leaf,
  location: MapPin,
  generic: Sparkles,
  suggestion: PlusCircle,
};

// Self-contained and rendered once at the app shell's top level, same as
// SpeciesDetailSheet - mounting it inside TopBar (a thin header component)
// constrained BottomSheet's full-screen absolute positioning to TopBar's
// own height instead of the whole screen.
export function NotificationsSheet() {
  const { notifications, unreadCount, markAllRead, markRead, sheetOpen, closeSheet, toggleWatchedSpecies, watchedSpecies } =
    useNotifications();
  const { locations: saved } = useSavedLocations();
  const { goToHoubyTimeline, requestMapFocus, setActive } = useAppNavigation();
  const { openSpecies } = useSpeciesDetail();
  const { setLocation } = useLocation();

  if (!sheetOpen) return null;

  // A tap both marks read and acts - a notification that just sits there
  // being read, same as before, was exactly the "not interactive" gap this
  // was built to close. Each kind's action is resolved from dedupeKey (see
  // notificationActions.ts) rather than stored, so no schema change was
  // needed to add this.
  function handlePress(n: AppNotification) {
    markRead(n.id);
    const action = resolveNotificationAction(n, saved);
    if (!action) return;
    if (action.type === "species") {
      openSpecies(action.speciesId);
    } else if (action.type === "houby-timeline") {
      goToHoubyTimeline();
    } else if (action.type === "map-location") {
      setLocation({ lat: action.lat, lon: action.lon, label: action.label });
      requestMapFocus(action.lat, action.lon, 11);
      setActive("Mapa");
    } else if (action.type === "watch-species") {
      if (!watchedSpecies.includes(action.speciesId)) toggleWatchedSpecies(action.speciesId);
    }
    closeSheet();
  }

  return (
    <BottomSheet onClose={closeSheet} maxHeight="80%">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Upozornění</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Označit vše jako přečtené</Text>
          </Pressable>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Bell size={ts(32)} strokeWidth={1.4} color={palette.inkFaint} />
          <Text style={styles.emptyTitle}>Zatím žádná upozornění</Text>
          <Text style={styles.emptyBody}>
            Tady se objeví zprávy o houbách ve vašich uložených místech, sledovaných druzích a sezónní tipy.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((n) => {
            const Icon = KIND_ICON[n.kind];
            return (
              <Pressable
                key={n.id}
                onPress={() => handlePress(n)}
                style={[styles.item, !n.read && styles.itemUnread]}
              >
                <View style={styles.itemIcon}>
                  <Icon size={ts(17)} strokeWidth={1.8} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>{n.title}</Text>
                    {!n.read && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.itemBody}>{n.body}</Text>
                  <Text style={styles.itemTime}>{relativeTime(n.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  title: { ...type.headingLg, color: palette.ink },
  markAll: { ...type.caption, color: palette.primary },
  empty: { alignItems: "center", paddingHorizontal: space.xxl, paddingVertical: space.xxl, gap: space.sm },
  emptyTitle: { ...type.headingSm, color: palette.ink, textAlign: "center" },
  emptyBody: { ...type.bodySmall, color: palette.inkSoft, textAlign: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  item: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  itemUnread: { backgroundColor: palette.bg, borderColor: palette.secondary },
  itemIcon: {
    width: ts(32),
    height: ts(32),
    borderRadius: radius.pill,
    backgroundColor: palette.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemTitle: { ...type.headingSm, color: palette.ink, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent },
  itemBody: { ...type.bodySmall, color: palette.inkSoft, marginTop: 2, lineHeight: 18 },
  itemTime: { ...type.caption, color: palette.inkFaint, marginTop: 4 },
});
