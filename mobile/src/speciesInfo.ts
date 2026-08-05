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
