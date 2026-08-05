// Real Leaflet map (OpenStreetMap + CARTO light basemap) as an HTML string,
// rendered via <iframe srcDoc> on web and react-native-webview on native.
// react-native-maps doesn't run in the web preview, so this is the one
// approach that looks identical in both places.
//
// Density mode: rendered as a smooth, continuously interpolated field per
// species (inverse-distance-weighted from the real grid points), painted to
// an offscreen <canvas> and dropped onto the map as a georeferenced image
// overlay. Two earlier approaches were tried and rejected:
//  - Leaflet.heat sums intensity from every nearby point, so a modest score
//    repeated at ~80 points summed into a solid nationwide blob — a
//    rendering artifact, not what the data said.
//  - Independent per-point circles ("islands") fixed the false-coverage
//    problem but looked like a grid of discs, and each disc has a visible
//    bullseye center that reads as "the mushrooms peak exactly here" even
//    though that point is just one grid sample among many.
// IDW interpolation with a short cutoff radius gives the storm-cell look
// that's actually true to the data: smooth, organic islands that hug real
// clusters of high-scoring points and fade to nothing (not a wash) wherever
// there's no nearby support — precise where the data is precise.

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

// Muted, low-saturation hues — this is data-series color for up to 3
// overlaid species layers, kept subdued so the map reads as a map first.
const LAYER_COLORS = ["#4F7A3D", "#9C6B3F", "#6E6690"];

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

  // Two distinct legend concerns, kept visually separate: which color is
  // which species (left), and what the shading of that color means (right)
  // — otherwise a fully-green map reads as "mushrooms confirmed everywhere"
  // instead of "this species' conditions are broadly favorable today".
  const legendSpeciesHtml = layers
    .map(
      ({ species, color }) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
           <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>
           <span>${species.name_cz}</span>
         </div>`
    )
    .join("");
  const legendHtml = `
    <div style="display:flex;gap:14px;align-items:flex-start;">
      <div>${legendSpeciesHtml}</div>
      <div style="border-left:1px solid #DBCFA9;padding-left:12px;">
        <div style="width:64px;height:9px;border-radius:5px;background:linear-gradient(to right, rgba(36,38,29,0.10), rgba(36,38,29,0.75));"></div>
        <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#8C8A6E;margin-top:2px;">
          <span>slabá</span><span>silná</span>
        </div>
      </div>
    </div>
    <div style="margin-top:6px;font-size:10px;color:#8C8A6E;max-width:230px;">
      Plocha = odhad podmínek podle počasí, půdy a lesa. Neznamená jistý nález.
    </div>`;

  const userMarkerJs =
    userLat != null && userLon != null
      ? `L.circleMarker([${userLat},${userLon}], {radius:6, color:'#24261D', weight:2, fillColor:'#EDE6D6', fillOpacity:1}).addTo(map).bindTooltip('Vaše poloha');`
      : "";

  // Nearest-grid-point lookup on tap — reports the best species among the
  // active layers at that point, so the sheet always has something to show.
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
  const layersJs = JSON.stringify(layers.map(({ species, color }) => ({ id: species.id, color })));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .cloud-layer { filter: blur(3px); }
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

    var gridPoints = ${pointsForClickJs};
    var speciesNames = ${speciesNamesJs};
    var layerDefs = ${layersJs};

    // Below this interpolated score, a pixel renders fully transparent —
    // "empty" is correct for a genuinely low-chance area, not a faint tint.
    var FLOOR = 20;
    // How far (in degrees, roughly lat-scaled) one grid point's influence
    // reaches. Kept short and close to the real grid spacing so a single
    // hot point makes a forest-scale island, not a province-scale wash.
    var CUTOFF_DEG = 0.30;
    var RENDER_W = 340, RENDER_H = 130;

    function hexToRgb(hex) {
      var v = parseInt(hex.slice(1), 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }

    function buildFieldDataUrl(speciesId, color) {
      var canvas = document.createElement('canvas');
      canvas.width = RENDER_W; canvas.height = RENDER_H;
      var ctx = canvas.getContext('2d');
      var img = ctx.createImageData(RENDER_W, RENDER_H);
      var latMin = ${CZ_BOUNDS[0][0]}, latMax = ${CZ_BOUNDS[1][0]};
      var lonMin = ${CZ_BOUNDS[0][1]}, lonMax = ${CZ_BOUNDS[1][1]};
      var rgb = hexToRgb(color);
      for (var y = 0; y < RENDER_H; y++) {
        var lat = latMax - (y / (RENDER_H - 1)) * (latMax - latMin);
        for (var x = 0; x < RENDER_W; x++) {
          var lon = lonMin + (x / (RENDER_W - 1)) * (lonMax - lonMin);
          var wsum = 0, ssum = 0;
          for (var i = 0; i < gridPoints.length; i++) {
            var p = gridPoints[i];
            var dlat = p.lat - lat;
            var dlon = (p.lon - lon) * 0.66; // rough longitude compression at this latitude
            var d = Math.sqrt(dlat * dlat + dlon * dlon);
            if (d >= CUTOFF_DEG) continue;
            var w = 1 - d / CUTOFF_DEG;
            w = w * w;
            wsum += w;
            ssum += w * (p.scores[speciesId] || 0);
          }
          var score = wsum > 0 ? ssum / wsum : 0;
          var idx = (y * RENDER_W + x) * 4;
          if (score < FLOOR) {
            img.data[idx + 3] = 0;
          } else {
            var t = (score - FLOOR) / (100 - FLOOR);
            var alpha = Math.min(1, 0.22 + t * 0.5);
            img.data[idx] = rgb[0]; img.data[idx + 1] = rgb[1]; img.data[idx + 2] = rgb[2];
            img.data[idx + 3] = Math.round(alpha * 255);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL();
    }

    layerDefs.forEach(function (layer) {
      L.imageOverlay(buildFieldDataUrl(layer.id, layer.color), ${JSON.stringify(CZ_BOUNDS)}, {
        className: 'cloud-layer',
        interactive: false,
      }).addTo(map);
    });

    ${userMarkerJs}

    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent) window.parent.postMessage(msg, '*');
    }

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
      notifyParent({ type: 'locationSelected', lat: best.lat, lon: best.lon, probabilityPct: topPct, topSpeciesName: speciesNames[topId], topSpeciesId: topId });
    });
  </script>
</body>
</html>`;
}
