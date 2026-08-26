import { useEffect } from "react";
import { useNotifications, type AppNotification } from "./NotificationContext";
import { useSavedLocations } from "./SavedLocationsContext";
import { getForecast } from "./api";
import { computeDailyOverall, findNextOpportunity } from "./forecastMath";
import { SPECIES_BY_ID } from "./speciesInfo";
import { useNotificationPrefs } from "./NotificationPrefsContext";

// One originally-written, pranostika-style headline per month - not a real
// quoted folk saying, just leaning into the wordplay Czech pranostiky are
// known for (same "field guide voice" as the rest of the app). The species
// named alongside it are computed at runtime from species.json, not
// hardcoded, so this can't drift from the real data.
//
// Checked 2026-08-06 against Czech foraging-season coverage (Deník.cz,
// nahouby.cz, Blesk.cz) for which months actually lead the season - see
// git history on this file for the full note.
const MONTH_HEADLINE: Record<number, string> = {
  1: "Leden si žije potichu - čas dobít síly na jaro.",
  2: "Únor bývá tichý, ale první náznaky jara se blíží.",
  3: "Březnové oteplení budí les k životu - první smrže se hlásí o slovo.",
  4: "Duben, ještě tam budem!",
  5: "Květen naplno otvírá sezónu.",
  6: "Červnová bouřka, houbařská hostina.",
  7: "Červenec žhne - houby taky, hlavně po bouřkách.",
  8: "Srpen sbírá síly na to, co přijde v září.",
  9: "Hvězdy září v září!",
  10: "Říjen rozjíždí poslední velkou vlnu roku.",
  11: "Listopad ještě umí překvapit.",
  12: "Prosinec patří vytrvalcům.",
};

function topSpeciesNamesForMonth(month: number, count: number): string[] {
  const all = Object.values(SPECIES_BY_ID);
  const peak = all.filter((sp) => sp.season_peak_months.includes(month));
  const pool = peak.length >= count ? peak : all.filter((sp) => sp.season_months.includes(month));
  return pool
    .slice()
    .sort((a, b) => b.gbif_occurrence_count_cz - a.gbif_occurrence_count_cz)
    .slice(0, count)
    .map((sp) => sp.name_cz);
}

// The actual "don't spam" lever. Every candidate below is real and
// dedupe-safe on its own, but showing all of them the moment they all
// happen to become true on the same day (a saved location's forecast
// turning good AND the month rolling over AND a watched species entering
// season) would read as a notification dump, not "a mushroom guide that
// checks in every so often." Only the single highest-priority candidate
// gets through each time this gate is open.
const MIN_DAYS_BETWEEN_NOTIFICATIONS = 6;

interface Candidate {
  priority: number; // lower = shown first when several are eligible at once
  dedupeKey: string;
  kind: AppNotification["kind"];
  title: string;
  body: string;
}

// Generates notifications client-side from data the app already fetches -
// there's no push infrastructure yet (no login, no device tokens), so this
// is an in-app notification center: it populates the bell with fresh
// entries whenever the app is opened, not a background/push mechanism.
export function useNotificationGenerator() {
  const { addNotification, watchedSpecies, notifications, loaded } = useNotifications();
  const { locations: saved, loaded: savedLoaded } = useSavedLocations();
  const { monthlyTipsEnabled, terrainSuggestionsEnabled, loaded: prefsLoaded } = useNotificationPrefs();

  useEffect(() => {
    if (!loaded || !savedLoaded || !prefsLoaded) return;
    let cancelled = false;

    async function run() {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      const monthKey = dateStr.slice(0, 7);
      const month = today.getMonth() + 1;
      const existingKeys = new Set(notifications.map((n) => n.dedupeKey));
      const candidates: Candidate[] = [];

      // Per saved location: today's real opportunity, or one within the
      // next 5 days - names the actual best species for that day/place
      // instead of a bare index number ("index 62/100" means nothing to
      // someone deciding whether to grab a basket; "skvělé podmínky pro
      // lišky" does). Also checks whether that location's real forest
      // composition (ÚHÚL/OSM - the same terrain data the score itself
      // uses) suggests a species worth watching that isn't yet.
      for (const loc of saved.filter((l) => l.alertsEnabled !== false)) {
        try {
          const data = await getForecast(loc.lat, loc.lon);
          const daily = computeDailyOverall(data);
          const opp = findNextOpportunity(daily, data.today);

          function bestSpeciesFor(target: string): string | null {
            let best: { name: string; pct: number } | null = null;
            for (const sp of data.species) {
              const day = sp.days.find((d) => d.date === target);
              if (day && (!best || day.probability_pct > best.pct)) best = { name: sp.name_cz, pct: day.probability_pct };
            }
            return best?.name ?? null;
          }

          if (opp.type === "now") {
            const todayWeather = data.weather.find((w) => w.date === data.today);
            const top = bestSpeciesFor(data.today);
            const opener = todayWeather && todayWeather.precipMm > 0 ? "Prší a jsou" : "Jsou";
            candidates.push({
              priority: 1,
              dedupeKey: `location:${loc.id}:${data.today}`,
              kind: "location",
              title: loc.label,
              body: top
                ? `${opener} ideální podmínky pro ${top.toLowerCase()}! Vyrazte, dokud to drží.`
                : `Dnes by tam mohly být houby - index ${opp.value}/100.`,
            });
          } else if (opp.type === "upcoming" && opp.daysAhead <= 5) {
            const top = bestSpeciesFor(opp.date);
            const dayWord = opp.daysAhead === 1 ? "den" : opp.daysAhead < 5 ? "dny" : "dní";
            candidates.push({
              priority: 2,
              dedupeKey: `location:${loc.id}:${opp.date}`,
              kind: "location",
              title: loc.label,
              body: top
                ? `Za ${opp.daysAhead} ${dayWord} by mohla začít sezóna na ${top.toLowerCase()} - naplánujte výlet.`
                : `Za ${opp.daysAhead} ${dayWord} by tam mohly začít růst houby.`,
            });
          }

          if (terrainSuggestionsEnabled) {
            // Fires at most once ever per location+species pair (no date in
            // the key) - the forest there doesn't change month to month, so
            // there's no reason to ever ask about the same pairing twice.
            for (const genus of data.terrain.treeGenera) {
              const match = Object.values(SPECIES_BY_ID).find(
                (sp) => sp.host_trees.includes(genus) && !watchedSpecies.includes(sp.id)
              );
              if (match) {
                candidates.push({
                  priority: 5,
                  dedupeKey: `terrain-suggest:${loc.id}:${match.id}`,
                  kind: "suggestion",
                  title: "Tip na sledování",
                  body: `Blízko ${loc.label} roste hodně stromů rodu ${genus} - chcete přidat ${match.name_cz.toLowerCase()} do sledovaných hub?`,
                });
                break; // one suggestion per location is plenty
              }
            }
          }
        } catch {
          // one location's forecast failing shouldn't block the rest
        }
      }

      watchedSpecies.forEach((id) => {
        const sp = SPECIES_BY_ID[id];
        if (!sp || !sp.season_months.includes(month)) return;
        const inPeak = sp.season_peak_months.includes(month);
        candidates.push({
          priority: inPeak ? 3 : 4,
          dedupeKey: `species:${id}:${monthKey}`,
          kind: "species",
          title: sp.name_cz,
          body: inPeak
            ? `Teď je vrchol sezóny pro ${sp.name_cz.toLowerCase()} - dobrá šance ji najít.`
            : `${sp.name_cz} začíná mít sezónu.`,
        });
      });

      // Lowest priority - always available as a fallback when nothing more
      // specific is happening.
      const headline = MONTH_HEADLINE[month];
      if (monthlyTipsEnabled && headline) {
        const names = topSpeciesNamesForMonth(month, 3);
        candidates.push({
          priority: 6,
          dedupeKey: `generic:${monthKey}`,
          kind: "generic",
          title: headline,
          body:
            names.length > 0
              ? `Teď mají sezónu: ${names.join(", ")}. Mrkněte na atlas hub.`
              : "Zrovna klidný měsíc pro houby - mrkněte na atlas, kdy se to zase rozjede.",
        });
      }

      if (cancelled) return;

      const fresh = candidates.filter((c) => !existingKeys.has(c.dedupeKey)).sort((a, b) => a.priority - b.priority);
      if (fresh.length === 0) return;

      const mostRecent = notifications[0]?.createdAt;
      const gateOpen =
        !mostRecent || Date.now() - new Date(mostRecent).getTime() >= MIN_DAYS_BETWEEN_NOTIFICATIONS * 86400000;
      if (!gateOpen) return;

      const chosen = fresh[0];
      addNotification({ dedupeKey: chosen.dedupeKey, kind: chosen.kind, title: chosen.title, body: chosen.body });
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, savedLoaded, prefsLoaded, saved, watchedSpecies, monthlyTipsEnabled, terrainSuggestionsEnabled]);
}
