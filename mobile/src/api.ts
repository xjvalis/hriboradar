import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";

// Real Vercel deployment (api/*.ts serverless functions) - this is what a
// published/store build talks to, since a phone on a real network has no
// route to anyone's "localhost". hriboradar.app is a custom domain added
// on top of the Vercel project (registered + connected 2026-08-26) -
// confirmed working via curl (real forecast JSON, not a stale/cached
// deployment) before this constant was switched over from the old
// rostou-delta.vercel.app auto-generated domain.
const PRODUCTION_API_BASE = "https://hriboradar.app";

// In dev, mobile talks to the local stand-in server (see /dev-server.mjs
// at the repo root, started with `npm run dev:api`) instead of the real
// deployment above - faster iteration, works offline, and lets you test
// backend changes before they're deployed.
//
// "localhost" only resolves on the machine actually running dev-server.mjs
// - fine for the web preview, broken on a phone in Expo Go. Constants'
// hostUri is the LAN address Metro is already using to serve the JS bundle
// to that phone, so reusing its host gets us the right IP automatically
// instead of a hardcoded address that breaks on a different network.
function resolveApiBase(): string {
  if (!__DEV__) return PRODUCTION_API_BASE;
  if (Platform.OS === "web") return "http://localhost:3001";
  // expoGoConfig's type dropped hostUri once expo-dev-client entered the
  // project (its shape differs slightly under a dev client vs pure Expo
  // Go) - the field still exists at runtime under Expo Go, so this stays
  // as a real fallback, just no longer statically typed.
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants.expoGoConfig as { hostUri?: string } | undefined)?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:3001`;
  
  // Fallback: if no hostUri available (offline, or build-time issue), 
  // use production as last resort so app doesn't crash with blank screens
  console.warn("[API] No dev hostUri found, falling back to production API");
  return PRODUCTION_API_BASE;
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
    // Real ÚHÚL-parsed genera when available (e.g. ["dub", "habr"]) - the
    // server (lib/terrain.ts) always sends this field, the client type just
    // hadn't caught up. Matches species.json's host_trees vocabulary, so
    // this is directly comparable without any translation layer.
    treeGenera: string[];
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

// Turns raw GPS coordinates ("Aktuální poloha") into a real place name -
// the label is a real address, the lat/lon in the result are still the
// exact GPS fix (see api/geocode.ts), not Nominatim's coarser point.
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult | null> {
  const res = await fetch(`${API_BASE}/api/geocode?lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results[0] ?? null;
}

export interface FeedbackInput {
  lat: number;
  lon: number;
  targetDate: string; // YYYY-MM-DD, today or yesterday only
  found: boolean;
  speciesIds: string[]; // species explicitly marked as found; [] when found is false
  quantityBucket: "few" | "basket" | "lots" | null;
}

// Goes through /api/feedback rather than inserting into Supabase directly -
// the server recomputes what the model actually predicted for that
// location/date/species from historical weather instead of trusting
// whatever the client sends, which is what lets the calibration loop treat
// this data as trustworthy (see api/feedback.ts). The Supabase access token
// tells the endpoint which signed-in user this is; without a session there's
// nothing to attach the feedback to.
export async function submitFeedback(input: FeedbackInput): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  // fetch() rejects (not just resolves non-ok) on a network-level failure -
  // offline, DNS, CORS. Caught here so this always resolves to a boolean
  // instead of throwing into ObservationSheet's submit(), which would leave
  // its loading spinner stuck forever with no error shown and no way to retry.
  try {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}
