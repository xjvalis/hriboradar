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

export interface ForecastResponse {
  location: { lat: number; lon: number };
  generated_at: string;
  today: string;
  terrain: {
    hasForestNearby: boolean;
    dominantType: string | null;
    polygonsFound: number;
  };
  species: SpeciesForecast[];
}

export async function getForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/forecast?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error(`Server vrátil chybu ${res.status}`);
  }
  return res.json();
}
