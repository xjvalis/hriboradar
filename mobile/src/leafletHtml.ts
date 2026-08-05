// Real Leaflet map (OpenStreetMap + CARTO light basemap) as an HTML string,
// rendered via <iframe srcDoc> on web and react-native-webview on native.
// react-native-maps doesn't run in the web preview, so this is the one
// approach that looks identical in both places.
//
// Density mode: each grid point renders as its OWN soft island, sized and
// tinted purely from its own score — deliberately NOT Leaflet.heat, whose
// "heat" model sums intensity from every nearby point. That's right for
// "density of events" (crashes, sightings) but wrong here: a 12% score
// repeated at 78 points across the whole country summed into a solid
// green blob, which is a rendering artifact, not what the data says.
// Independent islands mean low, wide-spread probability stays invisible,
// and only genuinely high scores show up — as islands over the region/
// forest that actually has them, not a nationwide wash.

export interface GridPoint {
  lat: number;
  lon: number;
  scores: Record<string, number>;
}

export interface SpeciesRef {
  id: string;
  name_cz: string;
}

export type MapMode = { type: "top3" } | { type: "species"; id: string };

const CZ_BOUNDS: [[number, number], [number, number]] = [
  [48.5, 12.0],
  [51.1, 18.9],
];

// Distinct categorical hues for up to 3 overlaid species layers — this is
// data-series color, not brand chrome, so it doesn't need to come from the
// app's own palette (same reason a chart legend uses its own key colors).
const LAYER_COLORS = ["#4F7A3D", "#B5652E", "#6B4C93"];

function pickTop3(points: GridPoint[], speciesList: SpeciesRef[]): SpeciesRef[] {
  const maxBySpecies = new Map<string, number>();
  for (const pt of points) {
    for (const [id, pct] of Object.entries(pt.scores)) {
      maxBySpecies.set(id, Math.max(maxBySpecies.get(id) ?? 0, pct));
    }
  }
  return [...speciesList]
    .sort((a, b) => (maxBySpecies.get(b.id) ?? 0) - (maxBySpecies.get(a.id) ?? 0))
    .slice(0, 3);
}

// Below this score, a point renders nothing at all — "empty" is the
// correct answer for a 12% day, not a faint tint.
const VISIBILITY_FLOOR_PCT = 30;
// How many meters an island's outer ring spans at 100% — scales down for
// lower (but still-visible) scores so weaker spots read as smaller, not
// just fainter.
const MAX_ISLAND_RADIUS_M = 26000;

function islandOpacity(scorePct: number): number {
  if (scorePct < VISIBILITY_FLOOR_PCT) return 0;
  const t = (scorePct - VISIBILITY_FLOOR_PCT) / (100 - VISIBILITY_FLOOR_PCT);
  return Math.pow(t, 1.3) * 0.75; // steep ramp — only strong scores get strongly visible
}

export function buildGridMapHtml(opts: {
  points: GridPoint[];
  speciesList: SpeciesRef[];
  mode: MapMode;
  userLat?: number;
  userLon?: number;
}) {
  const { points, speciesList, mode, userLat, userLon } = opts;

  const layers: { species: SpeciesRef; color: string }[] =
    mode.type === "top3"
      ? pickTop3(points, speciesList).map((sp, i) => ({ species: sp, color: LAYER_COLORS[i] }))
      : [
          {
            species: speciesList.find((s) => s.id === mode.id) ?? speciesList[0],
            color: LAYER_COLORS[0],
          },
        ];

  const islandsJs = layers
    .map(({ species, color }) => {
      const islands = points
        .map((p) => {
          const pct = p.scores[species.id] ?? 0;
          const opacity = islandOpacity(pct);
          if (opacity <= 0) return null;
          const t = (pct - VISIBILITY_FLOOR_PCT) / (100 - VISIBILITY_FLOOR_PCT);
          const radius = Math.round(MAX_ISLAND_RADIUS_M * (0.45 + 0.55 * t));
          return { lat: p.lat, lon: p.lon, opacity, radius };
        })
        .filter((x): x is { lat: number; lon: number; opacity: number; radius: number } => !!x);

      // Each island is 3 nested circles (soft falloff) instead of one hard
      // disc — independent per point, so nothing here sums with neighbors.
      return islands
        .map(
          (isl) => `
        L.circle([${isl.lat},${isl.lon}], {radius:${isl.radius}, stroke:false, fillColor:'${color}', fillOpacity:${(isl.opacity * 0.45).toFixed(3)}}).addTo(map);
        L.circle([${isl.lat},${isl.lon}], {radius:${Math.round(isl.radius * 0.62)}, stroke:false, fillColor:'${color}', fillOpacity:${(isl.opacity * 0.7).toFixed(3)}}).addTo(map);
        L.circle([${isl.lat},${isl.lon}], {radius:${Math.round(isl.radius * 0.3)}, stroke:false, fillColor:'${color}', fillOpacity:${isl.opacity.toFixed(3)}}).addTo(map);`
        )
        .join("");
    })
    .join("\n");

  const legendHtml = layers
    .map(
      ({ species, color }) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
           <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>
           <span>${species.name_cz}</span>
         </div>`
    )
    .join("");

  const userMarkerJs =
    userLat != null && userLon != null
      ? `L.circleMarker([${userLat},${userLon}], {radius:6, color:'#24261D', weight:2, fillColor:'#EDE6D6', fillOpacity:1}).addTo(map).bindTooltip('Vaše poloha');`
      : "";

  // Nearest-grid-point lookup on tap, since heat layers aren't individually
  // clickable features — reports the best species among the active layers
  // at that point, so the sheet always has something meaningful to show.
  const pointsForClickJs = JSON.stringify(
    points.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      scores: Object.fromEntries(layers.map(({ species }) => [species.id, p.scores[species.id] ?? 0])),
    }))
  );
  const speciesNamesJs = JSON.stringify(
    Object.fromEntries(layers.map(({ species }) => [species.id, species.name_cz]))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .legend { position: absolute; bottom: 10px; left: 10px; z-index: 1000; background: #F7F2E7ee;
      border: 1px solid #DBCFA9; border-radius: 10px; padding: 8px 10px; font: 11px -apple-system, sans-serif; color: #24261D; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">${legendHtml}</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true });
    map.fitBounds(${JSON.stringify(CZ_BOUNDS)});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    ${islandsJs}
    ${userMarkerJs}

    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent) window.parent.postMessage(msg, '*');
    }

    var gridPoints = ${pointsForClickJs};
    var speciesNames = ${speciesNamesJs};
    map.on('click', function(e) {
      var best = null, bestDist = Infinity;
      gridPoints.forEach(function(p) {
        var d = Math.pow(p.lat - e.latlng.lat, 2) + Math.pow(p.lon - e.latlng.lng, 2);
        if (d < bestDist) { bestDist = d; best = p; }
      });
      if (!best) return;
      var topId = null, topPct = -1;
      Object.keys(best.scores).forEach(function(id) {
        if (best.scores[id] > topPct) { topPct = best.scores[id]; topId = id; }
      });
      if (topId == null) return;
      notifyParent({ type: 'locationSelected', lat: best.lat, lon: best.lon, probabilityPct: topPct, topSpeciesName: speciesNames[topId] });
    });
  </script>
</body>
</html>`;
}
