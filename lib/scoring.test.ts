import { describe, expect, it } from "vitest";
import { scoreSpeciesDay, weatherPotential, MODEL_VERSION, type Species } from "./scoring";
import type { DayWeather } from "./weather";
import type { TerrainInfo } from "./terrain";

// Golden-snapshot guard against the exact failure mode a 2026-09-01 review
// flagged: api/feedback.ts recomputes a historical prediction from scratch
// with whatever scoring.ts is live *right now*, not a value captured at
// forecast time - which only stays honest if MODEL_VERSION is bumped every
// single time the formula's math changes. Nothing enforces that by hand.
// This test runs scoreSpeciesDay on fixed synthetic inputs (never real
// species.json/live weather - those can change for unrelated reasons) and
// snapshots the result. If a formula change shifts these numbers, this
// test fails - the fix is to bump MODEL_VERSION *and* run `npx vitest -u`
// to accept the new snapshot in the same commit, not to just silence it.
// A snapshot updated without a version bump is a bug, not a chore.

const SPECIES: Species = {
  id: "test-species",
  name_cz: "Testovací hříbek",
  name_latin: "Testus fixturus",
  group: "mykorhizní",
  host_trees: ["smrk", "borovice"],
  habitat: "test",
  soil: "test",
  moisture_need: "střední",
  temp_range_c: [12, 20],
  days_after_rain: [3, 8],
  min_rain_mm: 5,
  season_months: [8, 9, 10],
  season_peak_months: [9],
  gbif_occurrence_count_cz: 1000,
  edibility: "jedlá",
  model_confidence: "vysoká",
  confidence_note: "",
};

const TERRAIN_MATCH: TerrainInfo = {
  hasForestNearby: true,
  dominantType: "jehličnatý",
  treeGenera: ["smrk"],
  polygonsFound: 1,
  isUrban: false,
  source: "osm-grid",
};

const TERRAIN_UNKNOWN: TerrainInfo = {
  hasForestNearby: true,
  dominantType: null,
  treeGenera: [],
  polygonsFound: 1,
  isUrban: false,
  source: "osm-grid",
};

const TERRAIN_URBAN: TerrainInfo = { ...TERRAIN_MATCH, isUrban: true };

// 10 days: a dry spell, then a moderate rain event 4 days before "today"
// (index 9), so rain_timing sits mid-window and the antecedent/soil
// factors both have real (non-zero, non-maxed) values to snapshot.
function buildDays(): DayWeather[] {
  const days: DayWeather[] = [];
  for (let i = 0; i < 10; i++) {
    const date = new Date(2026, 8, i + 1).toISOString().slice(0, 10);
    const isRainDay = i === 5;
    days.push({
      date,
      precipMm: isRainDay ? 12 : 0,
      tempAvgC: 16,
      soilMoisturePct: isRainDay ? 22 : 14 + i * 0.3,
      antecedentWaterMm: isRainDay ? 9 : 2 + i * 0.5,
      isForecast: false,
    });
  }
  return days;
}

describe("scoreSpeciesDay (golden snapshot)", () => {
  it("matches the exact-genus-match, non-urban case", () => {
    const days = buildDays();
    const result = scoreSpeciesDay(days, 9, SPECIES, TERRAIN_MATCH);
    expect(result).toMatchSnapshot();
  });

  it("matches the unknown-forest-type case", () => {
    const days = buildDays();
    const result = scoreSpeciesDay(days, 9, SPECIES, TERRAIN_UNKNOWN);
    expect(result).toMatchSnapshot();
  });

  it("matches the urban-penalty case", () => {
    const days = buildDays();
    const result = scoreSpeciesDay(days, 9, SPECIES, TERRAIN_URBAN);
    expect(result).toMatchSnapshot();
  });

  it("matches the weather-only potential used by the map grid", () => {
    const days = buildDays();
    const result = weatherPotential(days, 9, SPECIES);
    expect(result).toMatchSnapshot();
  });

  it("never shows 100% - a near-textbook-perfect day still stays under the display ceiling", () => {
    // Peak season month, temp dead center of the ideal range, rain
    // landing exactly mid-window, and a huge recent storm - about as
    // favorable as real inputs get. Explicit product decision
    // (2026-09-02): no forecast should visibly claim certainty, so this
    // must land under 100 regardless of how good conditions are.
    const days: DayWeather[] = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(2026, 8, i + 1).toISOString().slice(0, 10);
      days.push({
        date,
        precipMm: i === 5 ? 45 : 0,
        tempAvgC: 16, // exact center of temp_range_c [12, 20]
        soilMoisturePct: 30,
        antecedentWaterMm: 25,
        isForecast: false,
      });
    }
    const result = scoreSpeciesDay(days, 9, SPECIES, TERRAIN_MATCH);
    expect(result.probability_pct).toBeLessThan(100);
    expect(result.probability_pct).toBeLessThanOrEqual(95);
    expect(weatherPotential(days, 9, SPECIES)).toBeLessThanOrEqual(95);
  });

  it("stays pinned to the version this snapshot was written under", () => {
    // If this fails, the formula changed AND the version was bumped, which
    // is correct - update this literal alongside deleting the stale
    // snapshot file (not just `vitest -u`), so the version bump is visible
    // in the diff instead of buried in a regenerated snapshot.
    expect(MODEL_VERSION).toBe("1.6.0");
  });
});
