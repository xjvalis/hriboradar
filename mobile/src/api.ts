// In dev, mobile talks to the local stand-in server (see /dev-server.mjs
// at the repo root, started with `npm run dev:api`). Point this at the
// real Vercel deployment once one exists.
const API_BASE = "http://localhost:3001";

export interface DayScore {
  date: string;
  probability_pct: number;
  factors: {
    season: number;
    temp: number;
    rain_timing: number;
    moisture: number;
    terrain: number;
    days_since_rain: number | null;
  };
}

export interface SpeciesForecast {
  id: string;
  name_cz: string;
  name_latin: string;
  edibility: string;
  model_confidence: string;
  days: DayScore[];
}

export interface DayWeather {
  date: string;
  tempC: number;
  soilMoisturePct: number;
  precipMm: number;
}

export interface ForecastResponse {
  location: { lat: number; lon: number };
  generated_at: string;
  today: string;
  terrain: {
    hasForestNearby: boolean;
    dominantType: string | null;
    polygonsFound: number;
  };
  weather: DayWeather[];
  species: SpeciesForecast[];
}

export async function getForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/forecast?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error(`Server vrátil chybu ${res.status}`);
  }
  return res.json();
}

export interface GridResponse {
  generated_at: string;
  threshold: number;
  gridSpacingM: number;
  points: {
    lat: number;
    lon: number;
    probabilityPct: number;
    topSpeciesName: string;
    topSpeciesId: string;
  }[];
}

// 20 for dev/testing (visible points even in a dry spell) — a live
// deployment should raise this to ~40 per the "only show real chances" ask.
export const GRID_THRESHOLD_PCT = 20;

export async function getGrid(threshold: number = GRID_THRESHOLD_PCT): Promise<GridResponse> {
  const res = await fetch(`${API_BASE}/api/grid?threshold=${threshold}`);
  if (!res.ok) {
    throw new Error(`Server vrátil chybu ${res.status}`);
  }
  return res.json();
}
