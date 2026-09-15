"""
Fills in the "forest present but type unknown" gap in lib/data/forest-grid.bin
using Copernicus Dominant Leaf Type (DLT) 2015, 20m resolution - a
satellite-derived broadleaved/coniferous classification with full,
gap-free coverage of Czechia. The existing OSM-only grid leaves ~92% of
forest cells at LEAF_UNKNOWN, since most Czech OSM forest polygons carry
neither uhul:slt nor leaf_type/wood tags - discovered 2026-09-15
investigating why the map showed near-uniform low probabilities for
tree-bound species everywhere while a saprotroph with no tree requirement
scored consistently high (its terrain factor doesn't depend on this data
at all - see lib/terrain.ts's terrainMatchFactor host_trees.length===0 case).

Deliberately additive, never destructive:
  - A cell with real OSM genus data (byte 0 != 0) is left untouched - that
    signal is more precise (exact tree genus, not just leaf shape) than
    anything DLT can offer.
  - A cell OSM already classified by leaf type (byte 1 in {1,2,3}) is left
    untouched - already as good as this pass would produce.
  - Only LEAF_NONE (0, "no forest data at all") and LEAF_UNKNOWN (4,
    "forest present but untyped") cells get a DLT-derived upgrade, and
    only when DLT actually has a confident classification for that spot -
    a cell DLT also has no signal for is left exactly as it was, never
    downgraded.
  - LEAF_NONE upgrading to real forest is intentional, not scope creep:
    the OSM forest-polygon extent has real gaps (found 2026-09-15 - a
    point deep in Krkonoše National Park came back with hasForestNearby:
    false), and DLT is a reliable satellite forest-cover signal that can
    close those.

Performance history: an earlier version did one rasterio .sample() call
per candidate cell (~17M estimated calls), then a windowed .read() per
cell (~680K calls) - still 5+ hours wall clock and killed before
finishing. This version instead reprojects each *entire* DLT tile onto
the destination grid in two GDAL warp calls total (one per
broadleaf/conifer binary mask, via rasterio.warp.reproject with
Resampling.average), which runs the resampling in GDAL's C warper
instead of a Python loop - seconds, not hours. The per-cell classify
step is then a fully vectorized numpy pass over the whole grid.

Run after build_forest_grid.py, not instead of it - this reads that
script's own output and writes the same file back with cells upgraded in
place. Re-run whenever forest-grid.bin is rebuilt from OSM.
"""

import json
import time
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling
from rasterio.warp import reproject

LEAF_NONE, LEAF_CONIFER, LEAF_BROADLEAF, LEAF_MIXED, LEAF_UNKNOWN = 0, 1, 2, 3, 4

# DLT's own pixel values (from the product's QGIS colour/legend file):
# 0 = all non-tree-covered areas, 1 = broadleaved, 2 = coniferous, 250 = nodata.
DLT_BROADLEAF, DLT_CONIFER = 1, 2

TILE_DIR = Path("data-prep/copernicus")
TILES = [
    TILE_DIR / "E40N20/DLT_2015_020m_eu_03035_d04_E40N20/DLT_2015_020m_eu_03035_d04_E40N20.tif",
    TILE_DIR / "E40N30/DLT_2015_020m_eu_03035_d04_E40N30/DLT_2015_020m_eu_03035_d04_E40N30.tif",
]

GRID_BIN = Path("lib/data/forest-grid.bin")
GRID_META = Path("lib/data/forest-grid.meta.json")

# A cell only gets upgraded to CONIFER/BROADLEAF outright when one type
# clearly dominates the DLT pixels found within it - otherwise MIXED,
# which is honest (a real transition zone or a genuinely mixed stand)
# rather than an overconfident single-genus call from a small block.
DOMINANCE_THRESHOLD = 0.75

# Below this combined (broadleaf_frac + conifer_frac) coverage, treat the
# cell as "DLT has no real signal here either" - avoids a false read from
# a sliver of forest at a target cell's edge or the average-resampling
# noise floor. Used for LEAF_UNKNOWN cells only, where OSM has ALREADY
# established real forest is present here - this bar only needs to be
# high enough to pick a believable type, not to decide forest existence.
MIN_COVERAGE_TYPE_ONLY = 0.05

# LEAF_NONE cells have no OSM forest signal at all - terrain.ts treats any
# non-LEAF_NONE leaf code as hasForestNearby=true, so upgrading one of
# these needs real confidence this 250m cell is meaningfully forested,
# not just a hedgerow or a few roadside trees at its edge tripping a low
# bar. 20% canopy cover is a conservative reading of the FAO/Copernicus
# convention (10%+ counts as "forest" in TCD) that leaves margin against
# resampling noise.
MIN_COVERAGE_NEW_FOREST = 0.20


def main():
    meta = json.loads(GRID_META.read_text(encoding="utf-8"))
    lat_min, lon_min = meta["latMin"], meta["lonMin"]
    lat_step, lon_step = meta["latStep"], meta["lonStep"]
    rows, cols, bytes_per_cell = meta["rows"], meta["cols"], meta["bytesPerCell"]

    grid = bytearray(GRID_BIN.read_bytes())
    assert len(grid) == rows * cols * bytes_per_cell, "grid.bin size doesn't match meta.json"

    # Destination grid: row 0 is latMin (south), so a north-up affine
    # transform needs latMin + (rows-1)*latStep at the top, y pixel size
    # negative. Cell (row, col) center is lat_min+row*lat_step /
    # lon_min+col*lon_step, so the cell's own top-left corner is half a
    # step further north/west of its center.
    top_lat = lat_min + (rows - 1) * lat_step + lat_step / 2
    left_lon = lon_min - lon_step / 2
    dst_transform = Affine(lon_step, 0, left_lon, 0, -lat_step, top_lat)
    dst_crs = "EPSG:4326"

    broadleaf_frac = np.zeros((rows, cols), dtype=np.float32)
    conifer_frac = np.zeros((rows, cols), dtype=np.float32)

    t0 = time.time()
    for tile_path in TILES:
        print(f"Reprojecting {tile_path.name} ...")
        with rasterio.open(tile_path) as ds:
            band = ds.read(1)  # uint8, full tile - a few GB, done one tile at a time
            broadleaf_mask = (band == DLT_BROADLEAF).astype(np.uint8)
            conifer_mask = (band == DLT_CONIFER).astype(np.uint8)
            del band

            # dst_transform is north-up (GDAL/rasterio convention: row 0 =
            # top = northernmost), but forest-grid.bin's own row order is
            # south-first (row 0 = latMin, see readCell in lib/terrain.ts
            # and the row/col formula below) - flip vertically right after
            # reprojection so row indices line up with the grid's own
            # convention. Skipping this flip was caught by a Wenceslas
            # Square (should be 0% forest) spot-check coming back
            # BROADLEAF - every cell was silently reading another
            # latitude band's data.
            tile_broadleaf = np.zeros((rows, cols), dtype=np.float32)
            reproject(
                source=broadleaf_mask,
                destination=tile_broadleaf,
                src_transform=ds.transform,
                src_crs=ds.crs,
                dst_transform=dst_transform,
                dst_crs=dst_crs,
                resampling=Resampling.average,
            )
            tile_broadleaf = np.flipud(tile_broadleaf)
            del broadleaf_mask

            tile_conifer = np.zeros((rows, cols), dtype=np.float32)
            reproject(
                source=conifer_mask,
                destination=tile_conifer,
                src_transform=ds.transform,
                src_crs=ds.crs,
                dst_transform=dst_transform,
                dst_crs=dst_crs,
                resampling=Resampling.average,
            )
            tile_conifer = np.flipud(tile_conifer)
            del conifer_mask

        # The two tiles are adjacent, non-overlapping (E40N20 south of
        # E40N30) - a target cell gets real signal from at most one of
        # them, so summing is equivalent to a masked overwrite here.
        broadleaf_frac += tile_broadleaf
        conifer_frac += tile_conifer
        print(f"  done ({time.time()-t0:.0f}s elapsed)")

    print(f"Reprojection done in {time.time()-t0:.0f}s. Classifying grid ...")

    genus = np.frombuffer(bytes(grid), dtype=np.uint8).reshape(rows, cols, bytes_per_cell)[:, :, 0]
    leaf = np.frombuffer(bytes(grid), dtype=np.uint8).reshape(rows, cols, bytes_per_cell)[:, :, 1].copy()

    eligible = (genus == 0) & np.isin(leaf, [LEAF_NONE, LEAF_UNKNOWN])
    coverage = broadleaf_frac + conifer_frac
    min_coverage = np.where(leaf == LEAF_UNKNOWN, MIN_COVERAGE_TYPE_ONLY, MIN_COVERAGE_NEW_FOREST)
    has_signal = eligible & (coverage >= min_coverage)

    conifer_ratio = np.zeros((rows, cols), dtype=np.float32)
    np.divide(conifer_frac, coverage, out=conifer_ratio, where=coverage > 0)

    new_leaf = leaf.copy()
    new_leaf[has_signal & (conifer_ratio >= DOMINANCE_THRESHOLD)] = LEAF_CONIFER
    new_leaf[has_signal & (conifer_ratio <= (1 - DOMINANCE_THRESHOLD))] = LEAF_BROADLEAF
    mixed_mask = has_signal & (conifer_ratio > (1 - DOMINANCE_THRESHOLD)) & (conifer_ratio < DOMINANCE_THRESHOLD)
    new_leaf[mixed_mask] = LEAF_MIXED

    upgraded_from_unknown = int(np.count_nonzero(has_signal & (leaf == LEAF_UNKNOWN)))
    upgraded_from_none = int(np.count_nonzero(has_signal & (leaf == LEAF_NONE)))
    conifer_n = int(np.count_nonzero(has_signal & (new_leaf == LEAF_CONIFER)))
    broadleaf_n = int(np.count_nonzero(has_signal & (new_leaf == LEAF_BROADLEAF)))
    mixed_n = int(np.count_nonzero(mixed_mask))

    grid_arr = np.frombuffer(bytes(grid), dtype=np.uint8).reshape(rows, cols, bytes_per_cell).copy()
    grid_arr[:, :, 1] = new_leaf

    print(
        f"\n{int(np.count_nonzero(eligible)):,} cells eligible, "
        f"{int(np.count_nonzero(has_signal)):,} had DLT signal and were upgraded "
        f"({upgraded_from_unknown:,} from 'forest, untyped', {upgraded_from_none:,} from 'no data at all')\n"
        f"New classifications: {conifer_n:,} conifer, {broadleaf_n:,} broadleaf, {mixed_n:,} mixed"
    )

    GRID_BIN.write_bytes(grid_arr.tobytes())
    print(f"Wrote {GRID_BIN} ({grid_arr.nbytes:,} bytes)")


if __name__ == "__main__":
    main()
