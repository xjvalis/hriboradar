import { useEffect } from "react";
import { useNotifications } from "./NotificationContext";
import { useSavedLocations } from "./SavedLocationsContext";
import { getForecast } from "./api";
import { computeDailyOverall, findNextOpportunity } from "./forecastMath";
import { SPECIES_BY_ID } from "./speciesInfo";

// One editorial line per month - the same "field guide voice" as the rest
// of the app, meant to nudge people toward mushrooming being a year-round
// thing rather than just a September hobby.
//
// Checked 2026-08-06 against Czech foraging-season coverage (Deník.cz,
// nahouby.cz, Blesk.cz) - consensus: season runs roughly June–Oct/Nov,
// intensive July–September, with September (and by long-term average,
// October) cited as the actual richest month, not August. The August line
// previously claimed it was "the peak of the season" outright, which
// overstated it - corrected to position August as building toward the
// September/October peak rather than being it.
const GENERIC_BY_MONTH: Record<number, string> = {
  1: "V lednu spí les, ale hlívy ústřičné a penízovky sametonohé vydrží i na mrazu.",
  2: "Únor bývá tichý, ale první ucháče se dají najít už teď.",
  3: "Březnové oteplení budí smrže a ucháče - vyrazte k vodě a na spáleniště.",
  4: "Dubnová vlhkost svědčí smržům a prvním hřibům v teplejších polohách.",
  5: "Květen naplno otevírá sezónu - hřiby, klouzky i kozáky.",
  6: "Červen bývá bohatý, pokud napršelo - houby rostou rychle v teple.",
  7: "Červenec je vrchol léta pro hřiby a lišky, hlídejte bouřky.",
  8: "Srpen patří k nejsilnějším měsícům, ale opravdová špička podle houbařů teprve přichází se zářím.",
  9: "Září bývá dlouhodobě nejbohatší měsíc - hřiby, václavky i kotrče najednou.",
  10: "Říjen je čas na podzimní vlnu - muchomůrky, čirůvky, ryzce.",
  11: "Listopad ještě umí překvapit, hlavně po teplejších dnech.",
  12: "Prosinec patří hlívám a dřevokazným houbám - sezóna se pomalu uzavírá.",
};

// Generates notifications client-side from data the app already fetches -
// there's no push infrastructure yet (no login, no device tokens), so this
// is an in-app notification center: it populates the bell with fresh
// entries whenever the app is opened, not a background/push mechanism.
export function useNotificationGenerator() {
  const { addNotification, watchedSpecies, loaded } = useNotifications();
  const { locations: saved, loaded: savedLoaded } = useSavedLocations();

  useEffect(() => {
    if (!loaded || !savedLoaded) return;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const monthKey = dateStr.slice(0, 7);
    const month = today.getMonth() + 1;

    const genericText = GENERIC_BY_MONTH[month];
    if (genericText) {
      addNotification({
        dedupeKey: `generic:${monthKey}`,
        kind: "generic",
        title: "Houbařský tip měsíce",
        body: genericText,
      });
    }

    watchedSpecies.forEach((id) => {
      const sp = SPECIES_BY_ID[id];
      if (!sp || !sp.season_months.includes(month)) return;
      const inPeak = sp.season_peak_months.includes(month);
      addNotification({
        dedupeKey: `species:${id}:${monthKey}`,
        kind: "species",
        title: sp.name_cz,
        body: inPeak
          ? `Teď je vrchol sezóny pro ${sp.name_cz.toLowerCase()} - dobrá šance ji najít.`
          : `${sp.name_cz} začíná mít sezónu.`,
      });
    });

    // Per-location, not a single blanket switch - toggled from the Moje
    // screen next to each saved place. Looks up to 5 days ahead (not just
    // today) via the same findNextOpportunity logic Předpověď's headline
    // uses, so a location with poor conditions today but a good day coming
    // up this week still gets a heads-up instead of staying silent.
    saved
      .filter((loc) => loc.alertsEnabled !== false)
      .forEach((loc) => {
        getForecast(loc.lat, loc.lon)
          .then((data) => {
            const daily = computeDailyOverall(data);
            const opp = findNextOpportunity(daily, data.today);
            if (opp.type === "now") {
              addNotification({
                dedupeKey: `location:${loc.id}:${data.today}`,
                kind: "location",
                title: loc.label,
                body: `Dnes by tam mohly být houby - index ${opp.value}/100.`,
              });
            } else if (opp.type === "upcoming" && opp.daysAhead <= 5) {
              const dayWord = opp.daysAhead === 1 ? "den" : opp.daysAhead < 5 ? "dny" : "dní";
              addNotification({
                dedupeKey: `location:${loc.id}:${opp.date}`,
                kind: "location",
                title: loc.label,
                body: `Za ${opp.daysAhead} ${dayWord} by tam mohly začít růst houby.`,
              });
            }
          })
          .catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, savedLoaded, saved, watchedSpecies]);
}
