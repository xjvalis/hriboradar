import speciesData from "./data/species.json";

// Static field-guide data (habitat, host trees, season, ...) — unlike
// weather/terrain scores this doesn't depend on location or date, so it's
// bundled straight from api/data/species.json rather than fetched.
export interface SpeciesInfo {
  id: string;
  name_cz: string;
  name_latin: string;
  group: string;
  host_trees: string[];
  habitat: string;
  soil: string;
  moisture_need: string;
  temp_range_c: number[];
  days_after_rain: number[];
  season_months: number[];
  season_peak_months: number[];
  gbif_occurrence_count_cz: number;
  edibility: string;
  model_confidence: string;
  confidence_note: string;
}

export const SPECIES_BY_ID: Record<string, SpeciesInfo> = Object.fromEntries(
  (speciesData.species as SpeciesInfo[]).map((sp) => [sp.id, sp])
);

const MONTH_NAMES_CZ = [
  "led",
  "úno",
  "bře",
  "dub",
  "kvě",
  "čvn",
  "čvc",
  "srp",
  "zář",
  "říj",
  "lis",
  "pro",
];

export function monthsToLabel(months: number[]): string {
  return [...months]
    .sort((a, b) => a - b)
    .map((m) => MONTH_NAMES_CZ[m - 1])
    .join(" · ");
}

export function groupLabel(group: string): string {
  if (group.includes("mykorhizní")) return "mykorhizní — roste ve vazbě na konkrétní stromy";
  if (group.includes("saprotrofní") && group.includes("parazit"))
    return "parazitická / saprotrofní — roste na dřevě";
  if (group.includes("saprotrofní")) return "saprotrofní — roste na opadu, ne na konkrétním stromu";
  if (group.includes("parazit")) return "parazitická — roste na dřevě, pařezech, kořenech";
  return group;
}

export const MONTH_NAMES_FULL_CZ = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

// Mycorrhizal fungi live in a years-long symbiosis with a specific host
// tree's roots — unlike a one-off saprotroph on decaying litter, a real
// find here is a genuine signal the same spot is worth remembering.
// Kotrč (parasitic on old pines) gets the same tip for the same underlying
// reason (it returns to the same root system year after year), so this is
// keyed off id there rather than group.
export function siteFidelityTip(info: SpeciesInfo): string | null {
  if (info.group.includes("mykorhizní")) {
    return "Žije roky ve svazku s konkrétním stromem — pokud tu houbu najdete, vyplatí se místo uložit a zkusit ho příští sezónu znovu.";
  }
  if (info.id === "kotrc-kadeřavy") {
    return "Typicky se vrací na stejné místo roky po sobě — dobrý kandidát na uložení mezi oblíbená místa.";
  }
  return null;
}
