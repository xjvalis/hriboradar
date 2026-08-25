"""
Turns raw Overpass elements (ways + relations tagged landuse=forest /
natural=wood) into a compact polygon list for the client to rasterize as a
mask. No shapely available in this environment, so this hand-rolls:
  - way geometry -> simple polygon (outer ring only, OSM ways for forest
    are almost always simple closed ways, not multipolygons)
  - relation geometry -> outer/inner rings from members, matched by role
  - area filter (drop slivers under MIN_AREA_M2 - mostly tiny "wood" tags
    for a handful of street trees, not real forest)
  - Douglas-Peucker simplification (tolerance tuned to roughly match the
    intended render resolution - no point keeping vertex detail finer than
    what will ever be drawn)
  - coordinates rounded to 3 decimals (~70-110m) to shrink JSON further

Run after fetch_forest_tiled.py (which writes forest-raw-tiled.json - not
committed, ~1GB, re-fetch from Overpass if you need to regenerate). Output
of this script (forest-cz.json) then gets copied to api/data/forest-cz.json,
which /api/forest.ts actually serves.
"""
import json
import math
import sys

MIN_AREA_M2 = 80000  # ~8 hectares - the render/mask resolution this feeds
                      # is ~480-550m/pixel (see MASK_W/H in leafletHtml.ts),
                      # so anything much smaller than that isn't visually
                      # distinguishable anyway - keeping it just bloats the
                      # payload the phone has to fetch and parse.
SIMPLIFY_TOLERANCE_DEG = 0.0026  # ~200-290m depending on latitude

LAT0 = 49.8  # mid-Czechia, for the lon->meters scale factor used in area calc


def ring_area_m2(ring):
    # Shoelace on an equirectangular approximation - fine for a filter
    # threshold, not for anything requiring survey accuracy.
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * math.cos(math.radians(LAT0))
    area = 0.0
    n = len(ring)
    for i in range(n):
        lat1, lon1 = ring[i]
        lat2, lon2 = ring[(i + 1) % n]
        x1, y1 = lon1 * m_per_deg_lon, lat1 * m_per_deg_lat
        x2, y2 = lon2 * m_per_deg_lon, lat2 * m_per_deg_lat
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def douglas_peucker(points, tolerance):
    if len(points) < 3:
        return points

    def perp_dist(pt, a, b):
        (px, py), (ax, ay), (bx, by) = pt, a, b
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0, min(1, t))
        cx, cy = ax + t * dx, ay + t * dy
        return math.hypot(px - cx, py - cy)

    def dp(pts):
        if len(pts) < 3:
            return pts
        dmax, idx = 0, 0
        for i in range(1, len(pts) - 1):
            d = perp_dist(pts[i], pts[0], pts[-1])
            if d > dmax:
                dmax, idx = d, i
        if dmax > tolerance:
            left = dp(pts[: idx + 1])
            right = dp(pts[idx:])
            return left[:-1] + right
        return [pts[0], pts[-1]]

    return dp(points)


def way_to_ring(el):
    geom = el.get("geometry")
    if not geom:
        return None
    ring = [(pt["lat"], pt["lon"]) for pt in geom]
    if len(ring) < 4:
        return None
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def relation_to_polygons(el):
    outers, inners = [], []
    for m in el.get("members", []):
        geom = m.get("geometry")
        if not geom:
            continue
        ring = [(pt["lat"], pt["lon"]) for pt in geom]
        if len(ring) < 4:
            continue
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        if m.get("role") == "inner":
            inners.append(ring)
        else:
            outers.append(ring)
    # Naive pairing: one polygon per outer ring, all inners attached to all
    # outers is wrong in general, but for forest multipolygons (usually 1
    # outer + 0-2 inner clearings) treating each outer as its own polygon
    # and testing inner containment isn't worth the complexity here - most
    # relations have exactly one outer ring.
    return [{"outer": o, "inners": inners if len(outers) == 1 else []} for o in outers]


def main():
    raw = json.load(open("forest-raw-tiled.json", encoding="utf-8"))
    elements = raw["elements"]
    print(f"Input elements: {len(elements)}", file=sys.stderr)

    polygons = []
    for el in elements:
        if el.get("type") == "way":
            ring = way_to_ring(el)
            if ring:
                polygons.append({"outer": ring, "inners": []})
        elif el.get("type") == "relation":
            polygons.extend(relation_to_polygons(el))

    print(f"Raw polygons: {len(polygons)}", file=sys.stderr)

    kept = []
    dropped_small = 0
    for poly in polygons:
        area = ring_area_m2(poly["outer"])
        if area < MIN_AREA_M2:
            dropped_small += 1
            continue
        kept.append(poly)
    print(f"Dropped as too small (<{MIN_AREA_M2}m2): {dropped_small}", file=sys.stderr)
    print(f"Kept: {len(kept)}", file=sys.stderr)

    out_polygons = []
    total_pts_before, total_pts_after = 0, 0
    for poly in kept:
        rings = [poly["outer"]] + poly["inners"]
        simplified_rings = []
        for ring in rings:
            total_pts_before += len(ring)
            simp = douglas_peucker(ring, SIMPLIFY_TOLERANCE_DEG)
            if len(simp) < 4:
                continue
            total_pts_after += len(simp)
            simplified_rings.append([[round(lat, 3), round(lon, 3)] for lat, lon in simp])
        if simplified_rings:
            out_polygons.append(simplified_rings)

    print(f"Points before simplify: {total_pts_before}, after: {total_pts_after}", file=sys.stderr)

    out = {"polygons": out_polygons}
    with open("forest-cz.json", "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    import os
    size = os.path.getsize("forest-cz.json")
    print(f"Wrote forest-cz.json: {size/1024:.0f} KB, {len(out_polygons)} polygons", file=sys.stderr)


if __name__ == "__main__":
    main()
