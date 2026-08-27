/**
 * Forest composition near a point, from a static grid built once from a
 * Czech OpenStreetMap extract (see data-prep/build_forest_grid.py) - not
 * fetched live. This is the piece that stops the app suggesting oak
 * mushrooms in a spruce forest, or any mycorrhizal species in a field or
 * city block.
 *
 * Used to query the live Overpass API per-request instead - dropped after
 * all 3 configured mirrors went down at once (2026-08-27), which is
 * exactly the kind of outage a hyper-local forecast app can't afford to
 * inherit. Landscape composition doesn't change day to day, so "fetch it
 * once, bake it into the deploy" is strictly better here: faster (no
 * network round trip), immune to a third party's uptime, and - since the
 * grid is 250m resolution instead of the old 1.5km search radius - more
 * precise too (a city block 300m from a small park no longer reads as
 * "forest nearby").
 *
 * Two signals per grid cell, best available wins - same as before:
 *  1. Tree genus bitmask - from `uhul:slt` (ÚHÚL forest-type text, e.g.
 *     "Bohatá habrová doubrava") keyword-matched at build time. The
 *     precise, species-level signal.
 *  2. Leaf-type fallback - coarser broadleaved/needleleaved/mixed, used
 *     only where no ÚHÚL-derived genus data exists for that cell.
 *
 * Coverage is real but patchy (depends on OSM mapping quality in that
 * area), so this is a best-effort signal, not a certified forest
 * inventory.
 */

import fs from "node:fs";
import path from "node:path";

export type DominantForestType = "jehličnatý" | "listnatý" | "smíšený" | null;

export interface TerrainInfo {
  hasForestNearby: boolean;
  dominantType: DominantForestType;
  treeGenera: string[]; // e.g. ["dub", "habr"] when ÚHÚL text was parsed
  polygonsFound: number; // 1 if any grid data was found at/near this point, 0 otherwise - a count no longer applies once forest is a raster, not discrete polygons
  // True when the point falls inside a built-up area (landuse=residential/
  // commercial/industrial/retail/construction/railway/garages) - applied as
  // its own penalty in lib/scoring.ts, independent of hasForestNearby,
  // since even a saprotrophic species that doesn't need a forest at all
  // still isn't realistically growing on a train station concourse.
  isUrban: boolean;
  source: "osm-grid";
}

// Must match data-prep/build_forest_grid.py's SLT_KEYWORDS order exactly -
// that's what fixes each genus's bit position in the grid's genus byte.
const GENUS_ORDER = ["smrk", "borovice", "dub", "buk", "habr", "bříza", "topol osika"];

const LEAF_NONE = 0,
  LEAF_CONIFER = 1,
  LEAF_BROADLEAF = 2,
  LEAF_MIXED = 3,
  // ~92% of real Czech OSM forest polygons carry neither uhul:slt nor
  // leaf_type/wood (measured at build time - see data-prep/build_forest_grid.py) -
  // this marks "yes, real forest here" for those, distinct from LEAF_NONE
  // ("no forest data at all"). leafTypeName() below falls through to null
  // for it, same as it always has for any code it doesn't recognize -
  // dominantType: null is exactly "forest present, type unknown."
  LEAF_UNKNOWN = 4;

interface GridMeta {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  cellM: number;
  latStep: number;
  lonStep: number;
  rows: number;
  cols: number;
  bytesPerCell: number;
}

let gridBuffer: Buffer | null = null;
let gridMeta: GridMeta | null = null;

// Loaded once per serverless instance (module-level cache, same pattern as
// api/data/species.json's static import) - the file is a few MB, trivial
// next to a cold start's other costs, and every request after the first
// reuses it from memory.
function loadGrid(): void {
  if (gridBuffer && gridMeta) return;
  const dataDir = path.join(__dirname, "data");
  gridMeta = JSON.parse(fs.readFileSync(path.join(dataDir, "forest-grid.meta.json"), "utf-8"));
  gridBuffer = fs.readFileSync(path.join(dataDir, "forest-grid.bin"));
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

// Ranks a leaf code by how informative it is, for merging across the 3x3
// neighborhood below: a real type (conifer/broadleaf/mixed) always beats
// LEAF_UNKNOWN ("forest, but no type on record"), which always beats
// LEAF_NONE ("no forest at all"). Plain numeric comparison doesn't work
// for this - LEAF_UNKNOWN=4 is numerically larger than the real-type
// codes 1-3, which previously let a later LEAF_NONE(0) neighbor
// incorrectly stomp an earlier LEAF_UNKNOWN(4) back down to 0 (found
// 2026-08-27: Smržovka's forest data vanished because 8 of its 9
// neighborhood cells were plain LEAF_NONE and iterated after the one
// real LEAF_UNKNOWN cell).
function leafPriority(code: number): number {
  if (code === LEAF_NONE) return 0;
  if (code === LEAF_UNKNOWN) return 1;
  return 2; // LEAF_CONIFER / LEAF_BROADLEAF / LEAF_MIXED
}

function leafTypeName(code: number): DominantForestType {
  if (code === LEAF_CONIFER) return "jehličnatý";
  if (code === LEAF_BROADLEAF) return "listnatý";
  if (code === LEAF_MIXED) return "smíšený";
  return null;
}

// Reads one cell's raw (genusMask, leafCode, isUrban) triple, or null if
// out of bounds or completely empty (no forest AND not built-up).
function readCell(row: number, col: number): { genusMask: number; leafCode: number; isUrban: boolean } | null {
  const meta = gridMeta!;
  if (row < 0 || row >= meta.rows || col < 0 || col >= meta.cols) return null;
  const offset = (row * meta.cols + col) * meta.bytesPerCell;
  const genusMask = gridBuffer![offset];
  const leafCode = gridBuffer![offset + 1];
  const isUrban = gridBuffer![offset + 2] === 1;
  if (genusMask === 0 && leafCode === 0 && !isUrban) return null;
  return { genusMask, leafCode, isUrban };
}

// A single 250m cell is precise, but a real houbař standing right at a
// forest's edge shouldn't get a hard "no" just because their exact GPS
// fix landed a few meters on the wrong side of it - so this checks a
// small 3x3-cell neighborhood (~750m box) around the point and unions
// whatever forest data any of those cells have. That's a deliberate,
// modest rounding (matches "trochu zaoblit ale ne moc" - a little
// tolerance, not a lot): a genuine city center has no forest data in any
// of the 9 cells either, so it still correctly reads as "no forest
// nearby," while a point right at a tree line doesn't flicker between
// yes/no depending on exactly which side of a 250m boundary it falls on.
const NEIGHBOR_RADIUS_CELLS = 1;

export async function fetchTerrain(lat: number, lon: number): Promise<TerrainInfo> {
  loadGrid();
  const meta = gridMeta!;

  if (lat < meta.latMin || lat > meta.latMax || lon < meta.lonMin || lon > meta.lonMax) {
    // Outside Czechia's bounding box entirely - no data by definition.
    return { hasForestNearby: false, dominantType: null, treeGenera: [], polygonsFound: 0, isUrban: false, source: "osm-grid" };
  }

  const centerRow = Math.floor((lat - meta.latMin) / meta.latStep);
  const centerCol = Math.floor((lon - meta.lonMin) / meta.lonStep);

  let genusMask = 0;
  let leafCode = LEAF_NONE;
  let found = false;
  for (let dr = -NEIGHBOR_RADIUS_CELLS; dr <= NEIGHBOR_RADIUS_CELLS; dr++) {
    for (let dc = -NEIGHBOR_RADIUS_CELLS; dc <= NEIGHBOR_RADIUS_CELLS; dc++) {
      const cell = readCell(centerRow + dr, centerCol + dc);
      if (!cell) continue;
      found = true;
      genusMask |= cell.genusMask;
      if (leafPriority(cell.leafCode) > leafPriority(leafCode)) leafCode = cell.leafCode;
    }
  }

  // Deliberately NOT unioned across the 3x3 neighborhood like forest data
  // above - that tolerance exists so a real forest edge doesn't flicker
  // based on which side of a 250m line the GPS fix lands on, but "urban"
  // means "the exact point itself is built-up," not "somewhere within
  // ~750m there's a building." Unioning it meant a real forest 200m
  // outside a small village (a very common Czech pattern - villages sit
  // right up against their surrounding woods) got the same penalty as
  // standing on the village square (found 2026-08-27 near Smržovka).
  const centerCell = readCell(centerRow, centerCol);
  const isUrban = centerCell?.isUrban ?? false;

  if (!found) {
    return { hasForestNearby: false, dominantType: null, treeGenera: [], polygonsFound: 0, isUrban, source: "osm-grid" };
  }

  const hasForestNearby = genusMask !== 0 || leafCode !== LEAF_NONE;
  const treeGenera = GENUS_ORDER.filter((_, i) => (genusMask & (1 << i)) !== 0);
  const dominantType = treeGenera.length > 0 ? forestTypeFromGenera(treeGenera) : leafTypeName(leafCode);

  return {
    hasForestNearby,
    dominantType,
    treeGenera,
    polygonsFound: hasForestNearby ? 1 : 0,
    isUrban,
    source: "osm-grid",
  };
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
  if (hostTrees.length === 0) return 1; // saprotrof/parazit - not tree-bound
  // Used to be a small 0.05 residual instead of a hard 0, hedging against
  // the old live Overpass 1.5km-radius search producing false negatives.
  // The static 250m grid (with its own small neighborhood check, see
  // NEIGHBOR_RADIUS_CELLS above) is precise and reliable enough that
  // "no forest nearby" can mean exactly that now - a mycorrhizal species
  // genuinely has ~0% chance in the middle of a city block.
  if (!terrain.hasForestNearby) return 0;

  if (terrain.treeGenera.length > 0) {
    const exactGenusMatch = hostTrees.some((t) => terrain.treeGenera.includes(t));
    if (exactGenusMatch) return 1;
    // ÚHÚL text told us the real genera and none match - strong negative signal.
    return 0.1;
  }

  const expected = expectedForestType(hostTrees);
  if (!expected || !terrain.dominantType) return 0.5; // forest present but type unknown
  if (expected === terrain.dominantType) return 0.85; // leaf-type-only match, softer confidence
  if (expected === "smíšený" || terrain.dominantType === "smíšený") return 0.7;
  return 0.15; // wrong forest type entirely (e.g. oak species, pure spruce forest)
}
