import type { AppNotification } from "./NotificationContext";
import type { SavedLocation } from "./SavedLocationsContext";

// What tapping a notification actually does - resolved from `kind` +
// `dedupeKey` rather than a stored payload column, since the generator
// already encodes everything needed (species id, saved-location id, month)
// into the dedupe key to make dedup itself work. Keeping the action derived
// avoids a schema migration for something recomputable from data already
// there.
export type NotificationAction =
  | { type: "species"; speciesId: string }
  | { type: "houby-timeline" }
  | { type: "map-location"; lat: number; lon: number; label: string }
  | { type: "watch-species"; speciesId: string };

// `saved` is needed to turn a location notification's bare id back into
// real coordinates to focus the map on - the id alone (all the dedupe key
// carries) isn't enough to navigate anywhere.
export function resolveNotificationAction(
  n: AppNotification,
  saved: SavedLocation[]
): NotificationAction | null {
  const parts = n.dedupeKey.split(":");
  const prefix = parts[0];

  if (prefix === "species" && parts[1]) {
    return { type: "species", speciesId: parts[1] };
  }
  if (prefix === "location" && parts[1]) {
    const loc = saved.find((l) => l.id === parts[1]);
    // The saved location may have been deleted since this notification was
    // generated - falling back to the atlas rather than doing nothing on
    // tap, since a dead-end tap is worse than a slightly-off destination.
    if (!loc) return { type: "houby-timeline" };
    return { type: "map-location", lat: loc.lat, lon: loc.lon, label: loc.label };
  }
  if (prefix === "terrain-suggest" && parts[2]) {
    return { type: "watch-species", speciesId: parts[2] };
  }
  if (prefix === "generic") {
    return { type: "houby-timeline" };
  }
  return null;
}
