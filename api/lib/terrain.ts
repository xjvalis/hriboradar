/**
 * Forest composition near a point, from OpenStreetMap via the Overpass API
 * (free, no key). This is the piece that stops the app suggesting oak
 * mushrooms in a spruce forest, or any mycorrhizal species in a field or
 * city block.
 *
 * Two signals, best available wins:
 *  1. `uhul:slt` — in some regions OSM forest polygons were imported
 *     straight from ÚHÚL's own typology WFS (source=UHULtypoWFS), with a
 *     real Czech forestry "skupina lesních typů" description like
 *     "Bohatá habrová doubrava". We keyword-match tree genera out of that
 *     text — the closest thing to real ÚHÚL data we can get without a
 *     licensed GIS pipeline.
 *  2. `leaf_type` / `wood` — coarser broadleaved/needleleaved/mixed tag,
 *     present on plain volunteer-mapped polygons. Used when there's no
 *     ÚHÚL import for that polygon.
 *
 * Coverage is real but patchy (depends on OSM mapping in that area), so
 * this is a best-effort signal, not a certified forest inventory.
 */

import { cached, roundCoord } from "./cache";

// overpass.kumi.systems was the only endpoint that reliably returned data
// with a proper User-Agent in testing; the official overpass-api.de
// cluster 406'd fetch() requests regardless of headers (Apache-level
// content-negotiation quirk) and its mirrors were intermittently
// overloaded. Keep multiple endpoints so one bad instance doesn't take
// the feature down.
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const SEARCH_RADIUS_M = 1500;

// Forest composition doesn't change minute to minute — cache aggressively.
const TERRAIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// But a failed lookup (Overpass down/rate-limited) gets a short TTL — long
// enough to stop every request paying the full timeout during an outage,
// short enough that we retry for real data soon after.
const TERRAIN_FAILURE_TTL_MS = 90 * 1000; // 90s
// Each endpoint gets less time before falling back — the old 9s x 3
// endpoints meant a single request could take up to 27s in the worst case.
const OVERPASS_TIMEOUT_MS = 5000;

export type DominantForestType = "jehličnatý" | "listnatý" | "smíšený" | null;

export interface TerrainInfo {
  hasForestNearby: boolean;
  dominantType: DominantForestType;
  treeGenera: string[]; // e.g. ["dub", "habr"] when ÚHÚL text was parsed
  polygonsFound: number;
  source: "osm-overpass";
}

interface OverpassElement {
  id: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Keyword -> our species.json host_trees vocabulary, matched against ÚHÚL
// "skupina lesních typů" free text (Czech forestry shorthand).
const SLT_KEYWORDS: [RegExp, string][] = [
  [/smrč|smrko/i, "smrk"],
  [/borov|bor(?!ov[áý] hora)/i, "borovice"],
  [/doubrav|doubí|dubin/i, "dub"],
  [/bučin|buč(?!ty)/i, "buk"],
  [/habr/i, "habr"],
  [/březin|březov/i, "bříza"],
  [/osikov|topolov/i, "topol osika"],
];

function generaFromSlt(slt: string): string[] {
  const found = new Set<string>();
  for (const [re, genus] of SLT_KEYWORDS) {
    if (re.test(slt)) found.add(genus);
  }
  return [...found];
}

function leafTypeFromTags(tags: Record<string, string>): DominantForestType {
  const value = tags.leaf_type ?? tags.wood;
  if (!value) return null;
  if (value === "broadleaved" || value === "deciduous") return "listnatý";
  if (value === "needleleaved" || value === "coniferous") return "jehličnatý";
  if (value === "mixed") return "smíšený";
  return null;
}

const CONIFER_TREES = new Set(["smrk", "borovice"]);
const BROADLEAF_TREES = new Set(["dub", "buk", "bříza", "habr", "topol osika"]);

function forestTypeFromGenera(genera: string[]): DominantForestType {
  if (genera.length === 0) return null;
  const hasConifer = genera.some((t) => CONIFER_TREES.has(t));
  const hasBroadleaf = genera.some((t) => BROADLEAF_TREES.has(t));
  if (hasConifer && hasBroadleaf) return "smíšený";
  if (hasConifer) return "jehličnatý";
  if (hasBroadleaf) return "listnatý";
  return null;
}

async function queryOne(endpoint: string, query: string): Promise<OverpassResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      // Some Overpass mirrors 406/429 requests without a real UA.
      "User-Agent": "RostouApp/0.1 (+https://github.com/xjvalis/rostou)",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Overpass ${endpoint} returned ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as OverpassResponse;
}

// Race all endpoints instead of trying them one after another — sequential
// fallback meant a request could wait up to endpoints.length x timeout
// before failing (measured ~15s cold). Racing means we wait only as long
// as the fastest endpoint that actually answers.
async function queryOverpass(query: string): Promise<OverpassResponse> {
  return Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => queryOne(endpoint, query)));
}

export function fetchTerrain(lat: number, lon: number): Promise<TerrainInfo> {
  const key = `terrain:${roundCoord(lat)},${roundCoord(lon)}`;
  return cached(
    key,
    TERRAIN_CACHE_TTL_MS,
    () => fetchTerrainUncached(lat, lon),
    // hasForestNearby:true + polygonsFound:0 only happens in the catch-all
    // fallback below (Overpass failed) — give that a short TTL instead of
    // the full day, so a transient outage self-heals quickly.
    (result) =>
      result.hasForestNearby && result.polygonsFound === 0 ? TERRAIN_FAILURE_TTL_MS : null
  );
}

async function fetchTerrainUncached(lat: number, lon: number): Promise<TerrainInfo> {
  const query = `[out:json][timeout:8];(way(around:${SEARCH_RADIUS_M},${lat},${lon})["landuse"="forest"];way(around:${SEARCH_RADIUS_M},${lat},${lon})["natural"="wood"];);out tags 30;`;

  try {
    const data = await queryOverpass(query);
    const elements = data.elements.filter((e) => e.tags);

    if (elements.length === 0) {
      return {
        hasForestNearby: false,
        dominantType: null,
        treeGenera: [],
        polygonsFound: 0,
        source: "osm-overpass",
      };
    }

    const generaCounts: Record<string, number> = {};
    const leafTypeCounts: Record<string, number> = {};
    for (const el of elements) {
      const tags = el.tags!;
      if (tags["uhul:slt"]) {
        for (const genus of generaFromSlt(tags["uhul:slt"])) {
          generaCounts[genus] = (generaCounts[genus] ?? 0) + 1;
        }
      }
      const leaf = leafTypeFromTags(tags);
      if (leaf) leafTypeCounts[leaf] = (leafTypeCounts[leaf] ?? 0) + 1;
    }

    const treeGenera = Object.entries(generaCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genus]) => genus);

    const dominantType =
      treeGenera.length > 0
        ? forestTypeFromGenera(treeGenera)
        : Object.entries(leafTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
            | DominantForestType
            | undefined ?? null;

    return {
      hasForestNearby: true,
      dominantType,
      treeGenera,
      polygonsFound: elements.length,
      source: "osm-overpass",
    };
  } catch {
    // Overpass down/timed out — treat as "unknown", not "no forest", so we
    // don't wrongly zero out every species just because a lookup failed.
    return {
      hasForestNearby: true,
      dominantType: null,
      treeGenera: [],
      polygonsFound: 0,
      source: "osm-overpass",
    };
  }
}

export function expectedForestType(hostTrees: string[]): DominantForestType {
  return forestTypeFromGenera(hostTrees);
}

/**
 * How well a species' host trees match what's actually growing nearby.
 * Exact ÚHÚL-derived genus match (when available) scores highest; a
 * leaf-type-only match is treated as weaker evidence.
 */
export function terrainMatchFactor(
  hostTrees: string[],
  terrain: TerrainInfo
): number {
  if (hostTrees.length === 0) return 1; // saprotrof/parazit — not tree-bound
  if (!terrain.hasForestNearby) return 0.05; // open field / city — mycorrhizal species need trees

  if (terrain.treeGenera.length > 0) {
    const exactGenusMatch = hostTrees.some((t) => terrain.treeGenera.includes(t));
    if (exactGenusMatch) return 1;
    // ÚHÚL text told us the real genera and none match — strong negative signal.
    return 0.1;
  }

  const expected = expectedForestType(hostTrees);
  if (!expected || !terrain.dominantType) return 0.5; // forest present but type unknown
  if (expected === terrain.dominantType) return 0.85; // leaf-type-only match, softer confidence
  if (expected === "smíšený" || terrain.dominantType === "smíšený") return 0.7;
  return 0.15; // wrong forest type entirely (e.g. oak species, pure spruce forest)
}
