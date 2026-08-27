"""
Builds a static forest-composition + built-up-area grid for Czechia from a
local OSM PBF extract (data-prep/osm/czech-republic-latest.osm.pbf,
downloaded once from Geofabrik - not fetched live). Replaces
lib/terrain.ts's live per-request Overpass API calls, which turned out to
be unreliable (observed a full outage of all 3 configured mirrors on
2026-08-27).

Uses osmium's AreaManager (two-pass area assembly) rather than reading
simple closed ways directly - a first attempt using only ways matched what
the old live Overpass query did (way(around:...)), but that undercounts
real forest badly: large/complex Czech forests are very commonly mapped as
OSM multipolygon relations (inner/outer rings for clearings, roads, lakes
cutting through them), not simple ways. Ways-only measured just 3,712 km^2
of total forest area against Czechia's real ~26,700 km^2 (14%); proper area
assembly (ways AND relations) measures ~34,000 km^2 - the right order of
magnitude (some overcounting vs. the official figure is expected, since
OSM's natural=wood/landuse=forest tagging is a bit broader than strict
forestry-statistics definitions).

Output: lib/data/forest-grid.bin - a flat binary raster over the same
BOUNDS used by lib/grid.ts (lat 48.55-51.06, lon 12.09-18.87), 3 bytes per
cell at ~250m resolution:
  byte 0: bitmask of tree genera present (bit i = SLT_KEYWORDS[i]'s genus),
          from uhul:slt (ÚHÚL forest-type text) keyword matches - the
          precise, species-level signal. Rare in practice (measured: only
          113 / 118,158+ source polygons carry it) but used whenever
          present.
  byte 1: leaf-type fallback - 0=no forest data, 1=jehličnatý,
          2=listnatý, 3=smíšený, 4=forest present but untyped (the common
          case - ~92% of polygons have neither uhul:slt nor leaf_type/wood
          at all). Only meaningful when byte 0 is 0.
  byte 2: 1 if this cell falls inside a built-up area (landuse=residential/
          commercial/industrial/retail/construction/railway/garages), else
          0. Independent of bytes 0-1 - a cell can (rarely) be both, e.g. a
          small wooded lot inside a railway yard's landuse polygon; the
          urban penalty in lib/scoring.ts applies regardless of forest
          data, since even a saprotrophic species that doesn't need a
          forest at all (bedla, václavka - see terrainMatchFactor's
          host_trees.length===0 case) still isn't realistically growing on
          a train station concourse.
0/0/0 means "no data at all" - open field, water, farmland, etc.

~250m cells are a deliberate rasterization tradeoff, not a bug: fine
enough that a real houbař can trust "this specific forest, this specific
species," coarse enough to fit comfortably in a single static file with
zero runtime dependency. Re-run this script whenever the OSM extract
should be refreshed (landscape composition changes on a years-long
timescale, not something to automate on a schedule).
"""

import json
import os
import re
import time

import osmium
import shapely.wkb as wkblib
from shapely.prepared import prep
from shapely.strtree import STRtree
from shapely.geometry import Point

# Must mirror lib/grid.ts's BOUNDS exactly - this grid and the app's own
# nationwide overview grid should agree on what counts as "Czechia."
LAT_MIN, LAT_MAX = 48.55, 51.06
LON_MIN, LON_MAX = 12.09, 18.87
CELL_M = 250
LAT_STEP = CELL_M / 111_000  # ~0.002252 deg
LON_STEP = CELL_M / (111_000 * 0.6472)  # cos(49.8 deg) - mid-latitude approximation, matches lib/terrain.ts's implicit assumption
N_ROWS = int((LAT_MAX - LAT_MIN) / LAT_STEP) + 1
N_COLS = int((LON_MAX - LON_MIN) / LON_STEP) + 1
BYTES_PER_CELL = 3

PBF_PATH = "data-prep/osm/czech-republic-latest.osm.pbf"

# Mirrors SLT_KEYWORDS in lib/terrain.ts exactly - same genus vocabulary,
# same regex intent, translated to Python. Order fixes each genus's bit
# position (see GENUS_BITS) - lib/terrain.ts's forest-grid reader must use
# this exact same order/bit mapping.
SLT_KEYWORDS = [
    (re.compile(r"smrč|smrko", re.I), "smrk"),
    (re.compile(r"borov|bor(?!ov[áý] hora)", re.I), "borovice"),
    (re.compile(r"doubrav|doubí|dubin", re.I), "dub"),
    (re.compile(r"bučin|buč(?!ty)", re.I), "buk"),
    (re.compile(r"habr", re.I), "habr"),
    (re.compile(r"březin|březov", re.I), "bříza"),
    (re.compile(r"osikov|topolov", re.I), "topol osika"),
]
GENUS_BITS = {genus: i for i, (_, genus) in enumerate(SLT_KEYWORDS)}

# LEAF_NONE (0) means "no forest data at this cell at all". LEAF_UNKNOWN
# covers the common case of a real forest area with neither uhul:slt nor
# leaf_type/wood tags - "no classification" and "no forest" are different
# facts and need different codes, or real forest silently vanishes from
# the grid (this bit us once already - see git history of this file).
LEAF_NONE, LEAF_CONIFER, LEAF_BROADLEAF, LEAF_MIXED, LEAF_UNKNOWN = 0, 1, 2, 3, 4

# landuse values that mean "clearly built up, not a realistic foraging
# spot" - deliberately not including cemetery/allotments/farmland, which
# really can grow mushrooms despite being "developed" in some sense.
URBAN_LANDUSE = {"residential", "commercial", "industrial", "retail", "construction", "railway", "garages"}


def genera_from_slt(slt: str) -> set:
    return {genus for pattern, genus in SLT_KEYWORDS if pattern.search(slt)}


def leaf_type_from_tags(tags) -> int:
    value = tags.get("leaf_type") or tags.get("wood")
    if value in ("broadleaved", "deciduous"):
        return LEAF_BROADLEAF
    if value in ("needleleaved", "coniferous"):
        return LEAF_CONIFER
    if value == "mixed":
        return LEAF_MIXED
    return LEAF_NONE


class AreaCollector(osmium.SimpleHandler):
    """Second-pass handler (fed through AreaManager) - collects every
    forest-tagged AND every built-up-landuse-tagged assembled area (from a
    simple way OR a multipolygon relation, osmium treats both uniformly as
    Area objects) in one pass over the file, classifying each once here
    rather than per grid cell later, which is what keeps the rasterization
    pass fast."""

    def __init__(self):
        super().__init__()
        self.wkbfab = osmium.geom.WKBFactory()
        self.forest_polygons = []  # (shapely geometry, genus_mask, leaf_code)
        self.urban_polygons = []  # (shapely geometry,)
        self.errors = 0

    def area(self, a):
        tags = a.tags
        is_forest = tags.get("natural") == "wood" or tags.get("landuse") == "forest"
        is_urban = tags.get("landuse") in URBAN_LANDUSE
        if not is_forest and not is_urban:
            return
        try:
            wkb = self.wkbfab.create_multipolygon(a)
            geom = wkblib.loads(wkb, hex=True)
        except Exception:
            self.errors += 1
            return
        if not geom.is_valid or geom.is_empty:
            geom = geom.buffer(0)
            if not geom.is_valid or geom.is_empty:
                self.errors += 1
                return

        if is_forest:
            slt = tags.get("uhul:slt")
            genus_mask = 0
            if slt:
                for genus in genera_from_slt(slt):
                    genus_mask |= 1 << GENUS_BITS[genus]
            leaf = leaf_type_from_tags(tags)
            if genus_mask == 0 and leaf == LEAF_NONE:
                leaf = LEAF_UNKNOWN
            self.forest_polygons.append((geom, genus_mask, leaf))
        if is_urban:
            self.urban_polygons.append((geom,))


def collect_areas():
    """The standard pyosmium two-pass area-assembly dance: pass 1 scans
    ways+relations to figure out which ways are needed as multipolygon
    members; pass 2 re-reads the file with a node-location index feeding
    AreaManager, which emits fully assembled Area geometries (handles
    inner/outer rings, i.e. real holes like clearings/lakes inside a
    forest, or a park carved out of a residential district) to our
    handler."""
    mgr = osmium.area.AreaManager()

    r1 = osmium.io.Reader(PBF_PATH, osmium.osm.osm_entity_bits.WAY | osmium.osm.osm_entity_bits.RELATION)
    osmium.apply(r1, mgr.first_pass_handler())
    r1.close()

    idx = osmium.index.create_map("flex_mem")
    location_handler = osmium.NodeLocationsForWays(idx)
    location_handler.ignore_errors()

    collector = AreaCollector()
    r2 = osmium.io.Reader(PBF_PATH)
    osmium.apply(r2, location_handler, mgr.second_pass_handler(collector))
    r2.close()

    return collector


def main():
    t0 = time.time()
    print(f"Grid: {N_ROWS} rows x {N_COLS} cols = {N_ROWS * N_COLS:,} cells ({CELL_M}m)")

    print("Assembling forest + built-up areas (ways + multipolygon relations)...")
    collector = collect_areas()
    print(
        f"  {len(collector.forest_polygons):,} forest areas, "
        f"{len(collector.urban_polygons):,} built-up areas, "
        f"{collector.errors:,} errors ({time.time()-t0:.0f}s)"
    )

    print("Building spatial indexes...")
    forest_geoms = [p[0] for p in collector.forest_polygons]
    forest_tree = STRtree(forest_geoms)
    forest_prepared = [prep(g) for g in forest_geoms]

    urban_geoms = [p[0] for p in collector.urban_polygons]
    urban_tree = STRtree(urban_geoms)
    urban_prepared = [prep(g) for g in urban_geoms]

    print("Rasterizing...")
    grid = bytearray(N_ROWS * N_COLS * BYTES_PER_CELL)
    filled_forest = 0
    filled_urban = 0
    for row in range(N_ROWS):
        lat = LAT_MIN + row * LAT_STEP
        if row % 200 == 0:
            print(f"  row {row}/{N_ROWS} ({time.time()-t0:.0f}s, {filled_forest:,} forest / {filled_urban:,} urban so far)")
        for col in range(N_COLS):
            lon = LON_MIN + col * LON_STEP
            cell_center = Point(lon, lat)
            offset = (row * N_COLS + col) * BYTES_PER_CELL

            genus_mask = 0
            leaf = LEAF_NONE
            for idx in forest_tree.query(cell_center):
                if forest_prepared[idx].contains(cell_center):
                    _, gm, lf = collector.forest_polygons[idx]
                    genus_mask |= gm
                    # A real classification always wins over LEAF_UNKNOWN
                    # from some other untagged area also touching this
                    # cell - prefer the more informative signal.
                    if lf and (leaf == LEAF_NONE or leaf == LEAF_UNKNOWN):
                        leaf = lf
            if genus_mask or leaf:
                grid[offset] = genus_mask & 0xFF
                grid[offset + 1] = leaf
                filled_forest += 1

            for idx in urban_tree.query(cell_center):
                if urban_prepared[idx].contains(cell_center):
                    grid[offset + 2] = 1
                    filled_urban += 1
                    break

    total = N_ROWS * N_COLS
    print(
        f"Done rasterizing: {filled_forest:,}/{total:,} forest ({filled_forest/total*100:.1f}%), "
        f"{filled_urban:,}/{total:,} built-up ({filled_urban/total*100:.1f}%) ({time.time()-t0:.0f}s)"
    )

    os.makedirs("lib/data", exist_ok=True)
    with open("lib/data/forest-grid.bin", "wb") as f:
        f.write(bytes(grid))
    print(f"Wrote lib/data/forest-grid.bin ({len(grid):,} bytes)")

    # Small sidecar so lib/terrain.ts doesn't need to hardcode the grid
    # geometry constants twice (Python here, TypeScript there) - it just
    # reads this at startup instead.
    meta = {
        "latMin": LAT_MIN, "latMax": LAT_MAX, "lonMin": LON_MIN, "lonMax": LON_MAX,
        "cellM": CELL_M, "latStep": LAT_STEP, "lonStep": LON_STEP,
        "rows": N_ROWS, "cols": N_COLS,
        "bytesPerCell": BYTES_PER_CELL,
        "genusBits": GENUS_BITS,
    }
    with open("lib/data/forest-grid.meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("Wrote lib/data/forest-grid.meta.json")


if __name__ == "__main__":
    main()
