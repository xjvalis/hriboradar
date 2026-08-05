import { Platform } from "react-native";
import Constants from "expo-constants";

// In dev, mobile talks to the local stand-in server (see /dev-server.mjs
// at the repo root, started with `npm run dev:api`). Point this at the
// real Vercel deployment once one exists.
//
// "localhost" only resolves on the machine actually running dev-server.mjs
// — fine for the web preview, broken on a phone in Expo Go. Constants'
// hostUri is the LAN address Metro is already using to serve the JS bundle
// to that phone, so reusing its host gets us the right IP automatically
// instead of a hardcoded address that breaks on a different network.
function resolveApiBase(): string {
  if (Platform.OS === "web") return "http://localhost:3001";
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:3001` : "http://localhost:3001";
}

export const API_BASE = resolveApiBase();

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

export interface CurrentConditions {
  tempC: number;
  precipMm: number;
  time: string;
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
  current: CurrentConditions | null;
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
  gridSpacingM: number;
  speciesList: { id: string; name_cz: string }[];
  points: { lat: number; lon: number; overall: number; scores: Record<string, number> }[];
}

export async function getGrid(): Promise<GridResponse> {
  const res = await fetch(`${API_BASE}/api/grid`);
  if (!res.ok) {
    throw new Error(`Server vrátil chybu ${res.status}`);
  }
  return res.json();
}

export interface GeocodeResult {
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
}

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];
  const res = await fetch(`${API_BASE}/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results;
}
