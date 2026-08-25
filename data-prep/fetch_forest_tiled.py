"""
Fetches Czech forest/wood polygons from OpenStreetMap via Overpass, tile by
tile (a single whole-country query 502's/times-out on every public mirror
tried). Merges results by element id to drop duplicates from features
straddling tile edges. Checkpoints after every tile so an interruption
doesn't lose progress.
"""
import json
import os
import subprocess
import sys
import time

LAT_MIN, LAT_MAX = 48.5, 51.1
LON_MIN, LON_MAX = 12.0, 18.9
COLS, ROWS = 5, 4  # 20 tiles

ENDPOINT = "https://overpass.openstreetmap.fr/api/interpreter"
CHECKPOINT = "forest-raw-tiled.json"
PROGRESS = "forest-fetch-progress.json"

QUERY_TMPL = """[out:json][timeout:90];
(
  way["landuse"="forest"]({s},{w},{n},{e});
  way["natural"="wood"]({s},{w},{n},{e});
  relation["landuse"="forest"]({s},{w},{n},{e});
  relation["natural"="wood"]({s},{w},{n},{e});
);
out geom;"""

all_elements = {}
done_tiles = set()

if os.path.exists(CHECKPOINT) and os.path.exists(PROGRESS):
    try:
        prev = json.load(open(CHECKPOINT, encoding="utf-8"))
        for el in prev["elements"]:
            all_elements[(el.get("type"), el.get("id"))] = el
        done_tiles = set(tuple(x) for x in json.load(open(PROGRESS, encoding="utf-8")))
        print(f"Resuming: {len(all_elements)} elements, {len(done_tiles)} tiles already done", file=sys.stderr)
    except Exception as ex:
        print(f"Could not resume ({ex}), starting fresh", file=sys.stderr)


def save_checkpoint():
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump({"elements": list(all_elements.values())}, f)
    with open(PROGRESS, "w", encoding="utf-8") as f:
        json.dump(list(done_tiles), f)


lat_step = (LAT_MAX - LAT_MIN) / ROWS
lon_step = (LON_MAX - LON_MIN) / COLS

tile_i = 0
total_tiles = ROWS * COLS
for r in range(ROWS):
    for c in range(COLS):
        tile_i += 1
        if [r, c] in [list(x) for x in done_tiles] or (r, c) in done_tiles:
            print(f"[{tile_i}/{total_tiles}] tile r{r}c{c} already done, skipping", file=sys.stderr)
            continue

        s = LAT_MIN + r * lat_step
        n = LAT_MIN + (r + 1) * lat_step
        w = LON_MIN + c * lon_step
        e = LON_MIN + (c + 1) * lon_step
        query = QUERY_TMPL.format(s=s, w=w, n=n, e=e)

        ok = False
        for attempt in range(3):
            print(f"[{tile_i}/{total_tiles}] tile r{r}c{c} attempt {attempt+1}", file=sys.stderr, flush=True)
            try:
                result = subprocess.run(
                    ["curl", "-s", "-X", "POST", "--data-binary", query, ENDPOINT,
                     "--max-time", "100", "-w", "\nHTTP:%{http_code}"],
                    capture_output=True, timeout=110,  # bytes, not text - JSON has non-ASCII (place names etc.)
                )
                out = result.stdout.decode("utf-8", errors="replace")
                if "\nHTTP:" not in out:
                    print("  no HTTP marker, retrying", file=sys.stderr)
                    continue
                body, http_line = out.rsplit("\nHTTP:", 1)
                code = http_line.strip()
                if code != "200":
                    print(f"  HTTP {code}, retrying", file=sys.stderr)
                    time.sleep(3)
                    continue
                data = json.loads(body)
                els = data.get("elements", [])
                print(f"  got {len(els)} elements", file=sys.stderr, flush=True)
                for el in els:
                    key = (el.get("type"), el.get("id"))
                    all_elements[key] = el
                ok = True
                break
            except Exception as ex:
                print(f"  error: {ex}", file=sys.stderr)
                time.sleep(3)
                continue
        if ok:
            done_tiles.add((r, c))
            save_checkpoint()
        else:
            print(f"  TILE FAILED r{r}c{c} (giving up after retries)", file=sys.stderr)
        time.sleep(1)

print(f"Total unique elements: {len(all_elements)}", file=sys.stderr)
save_checkpoint()
print("Wrote forest-raw-tiled.json", file=sys.stderr)
