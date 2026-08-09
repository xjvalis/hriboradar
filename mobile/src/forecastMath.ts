import type { ForecastResponse } from "./api";
import { scoreTier } from "./theme";

// Same "overall conditions" definition as api/grid.ts's overallScore() -
// a weighted average of a location's own best 3 species, not the single
// best species (that's a different question) and not a flat mean across
// all 15 (a saprotroph-heavy species list would permanently drag that
// near zero). Recomputed here client-side because /api/forecast returns
// per-species days, not a precomputed daily overall the way /api/grid
// does for "today" - this is the same shape of number applied across the
// week instead of one snapshot.
const OVERALL_WEIGHTS = [0.5, 0.3, 0.2];

export interface DayOverall {
  date: string;
  overall: number;
}

export function computeDailyOverall(detail: ForecastResponse): DayOverall[] {
  // /api/forecast's weather[] starts at yesterday (needed server-side for
  // days-since-rain lookback) - not relevant to a forward-looking forecast.
  return detail.weather
    .filter((w) => w.date >= detail.today)
    .map((w) => {
      const scores = detail.species
        .map((sp) => sp.days.find((d) => d.date === w.date)?.probability_pct ?? 0)
        .sort((a, b) => b - a)
        .slice(0, OVERALL_WEIGHTS.length);
      const weightUsed = OVERALL_WEIGHTS.slice(0, scores.length).reduce((a, b) => a + b, 0);
      const weighted = scores.reduce((sum, v, i) => sum + v * OVERALL_WEIGHTS[i], 0);
      return { date: w.date, overall: weightUsed > 0 ? Math.round(weighted / weightUsed) : 0 };
    });
}

export type NextOpportunity =
  | { type: "now"; value: number }
  | { type: "upcoming"; date: string; daysAhead: number }
  | { type: "none" };

// "Notable" = clears the same medium-tier bar the rest of the app already
// uses for a badge to stop reading as background noise (scoreTier, theme.ts)
// - not a separate, newly-invented threshold.
export function findNextOpportunity(daily: DayOverall[], todayStr: string): NextOpportunity {
  const todayIdx = daily.findIndex((d) => d.date === todayStr);
  if (todayIdx === -1) return { type: "none" };
  if (scoreTier(daily[todayIdx].overall) !== "poor") return { type: "now", value: daily[todayIdx].overall };
  for (let i = todayIdx + 1; i < daily.length; i++) {
    if (scoreTier(daily[i].overall) !== "poor") {
      return { type: "upcoming", date: daily[i].date, daysAhead: i - todayIdx };
    }
  }
  return { type: "none" };
}

const WEEKDAYS_CZ = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export function weekdayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Dnes";
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS_CZ[d.getDay()];
}

export function dayMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
