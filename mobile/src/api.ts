import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";

// Real Vercel deployment (api/*.ts serverless functions) - this is what a
// published/store build talks to, since a phone on a real network has no
// route to anyone's "localhost". Note this is NOT the vercel.app project
// slug you'd guess from the dashboard URL - "rostou.vercel.app" turned out
// to belong to an unrelated older deployment (a static Lovable mockup
// export) that had already claimed that exact subdomain; Vercel assigned
// this project "rostou-delta.vercel.app" instead. Confirmed working
// 2026-08-09 (real forecast JSON, not the mockup) - if this ever needs to
// change, check Vercel dashboard → Settings → Domains, don't assume the
// obvious slug.
const PRODUCTION_API_BASE = "https://rostou-delta.vercel.app";

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

export interface ObservationInput {
  lat: number;
  lon: number;
  date: string;
  found: boolean;
  speciesIds?: string[];
  note?: string;
}

// Writes straight to Supabase instead of through a Vercel API route - the
// old /api/observations serverless function tried to append to a local
// JSONL file, which doesn't work on Vercel's read-only/ephemeral
// filesystem (every submission there 500'd). Row Level Security on
// rostou_observations (see supabase/rostou_schema.sql) scopes each insert
// to the signed-in user automatically via auth.uid(), so there's no
// user_id to pass here - an unauthenticated caller simply can't insert.
export async function submitObservation(input: ObservationInput): Promise<boolean> {
  const { error } = await supabase.from("rostou_observations").insert({
    lat: input.lat,
    lon: input.lon,
    date: input.date,
    found: input.found,
    species_ids: input.speciesIds ?? [],
    note: input.note ?? null,
  });
  return !error;
}
