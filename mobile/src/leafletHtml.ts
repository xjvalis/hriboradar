// Real Leaflet map (OpenStreetMap tiles, CARTO light basemap) as an HTML
// string, rendered via <iframe srcDoc> on web and react-native-webview on
// native. react-native-maps doesn't run in the web preview, so this is the
// one approach that looks identical in both places.
//
// The page is built ONCE per (grid data, user location) and never rebuilt
// just to switch what's being visualized — switching between "všechny
// houby" and a single species sends a postMessage into the already-loaded
// page (see applyMode/handleIncoming below), which repaints the overlay in
// place and crossfades it. Rebuilding the whole iframe/WebView on every
// chip tap would reset pan/zoom and reload every map tile, which is both
// slow and disorienting mid-interaction.
//
// Rendering: per-pixel inverse-distance-weighted interpolation from the
// real grid points, rasterized to an offscreen <canvas>, dropped on the
// map as a georeferenced image overlay (+ light CSS blur for organic
// softness). A short cutoff radius keeps influence local, so real gaps
// between regions stay gaps (disconnected islands) instead of the whole
// country reading as one continuous wash.
//
// Exactly one field is ever drawn at a time — "všechny houby" (a blended
// overall-conditions score, see api/grid.ts) OR one selected species,
// never several species layered together. Compositing multiple
// semi-transparent species colors was tried and rejected: overlapping
// areas alpha-blended into a darker/muddier mix that read as "more
// mushrooms here" when it just meant two unrelated species happened to
// both be present nearby.

export interface GridPoint {
  lat: number;
  lon: number;
  overall: number;
  scores: Record<string, number>;
}

export interface SpeciesRef {
  id: string;
  name_cz: string;
}

export type MapMode = { type: "overall" } | { type: "species"; id: string };

const CZ_BOUNDS: [[number, number], [number, number]] = [
  [48.5, 12.0],
  [51.1, 18.9],
];

export function buildGridMapHtml(opts: {
  points: GridPoint[];
  speciesList: SpeciesRef[];
  userLat?: number;
  userLon?: number;
  initialMode?: MapMode;
}) {
  const { points, speciesList, userLat, userLon, initialMode = { type: "overall" } } = opts;

  const userMarkerJs =
    userLat != null && userLon != null
      ? `L.circleMarker([${userLat},${userLon}], {radius:6, color:'#24261D', weight:2, fillColor:'#EDE6D6', fillOpacity:1}).addTo(map).bindTooltip('Vaše poloha');`
      : "";

  const pointsJs = JSON.stringify(
    points.map((p) => ({ lat: p.lat, lon: p.lon, overall: p.overall, scores: p.scores }))
  );
  const speciesNamesJs = JSON.stringify(
    Object.fromEntries(speciesList.map((sp) => [sp.id, sp.name_cz]))
  );
  const initialModeJs = JSON.stringify(initialMode);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .cloud-layer { filter: blur(3px); transition: opacity 420ms ease; }
    .legend { position: absolute; bottom: 10px; left: 10px; z-index: 1000; background: #F7F2E7ee;
      border: 1px solid #DBCFA9; border-radius: 10px; padding: 8px 10px; font: 11px -apple-system, sans-serif; color: #24261D; max-width: 200px; }
    .legend-title { font-weight: 600; font-size: 10.5px; letter-spacing: 0.4px; text-transform: uppercase; color: #54563E; margin-bottom: 5px; }
    .legend-bar { height: 9px; border-radius: 5px; }
    .legend-labels { display:flex; justify-content:space-between; font-size: 9.5px; color: #8C8A6E; margin-top: 2px; }
    .legend-caption { margin-top: 6px; font-size: 10px; color: #8C8A6E; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true });
    map.fitBounds(${JSON.stringify(CZ_BOUNDS)});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    var gridPoints = ${pointsJs};
    var speciesNames = ${speciesNamesJs};

    // Below this interpolated score, a pixel renders fully transparent —
    // "empty" is correct for a genuinely low-chance area, not a faint tint.
    var FLOOR = 20;
    // How far (in degrees, roughly lat-scaled) one grid point's influence
    // reaches. Kept short and close to the real grid spacing so a single
    // hot spot makes a forest-scale island, not a province-scale wash —
    // this is also what keeps separate strong regions as separate islands
    // instead of merging into one blob across the weak area between them.
    var CUTOFF_DEG = 0.30;
    var RENDER_W = 340, RENDER_H = 130;

    // Continuous color ramps, not discrete bands — each stop is
    // [score, r, g, b, alpha]; colorAt() linearly interpolates between the
    // two bracketing stops. "Všechny houby" reads as a weather-radar-style
    // progression (green -> yellow -> orange -> red = how good, in
    // general); a single species stays one hue getting deeper (= how
    // likely, specifically), so the two modes never look like the same
    // kind of information.
    var OVERALL_STOPS = [
      [0, 79, 122, 61, 0],
      [20, 79, 122, 61, 0],
      [40, 79, 122, 61, 0.45],
      [60, 176, 173, 58, 0.55],
      [75, 214, 140, 50, 0.68],
      [90, 176, 58, 44, 0.8],
      [100, 145, 40, 32, 0.88]
    ];
    var SPECIES_STOPS = [
      [0, 79, 122, 61, 0],
      [20, 79, 122, 61, 0],
      [55, 79, 122, 61, 0.5],
      [100, 36, 52, 32, 0.85]
    ];

    function colorAt(stops, score) {
      var s = Math.max(0, Math.min(100, score));
      for (var i = 1; i < stops.length; i++) {
        if (s <= stops[i][0]) {
          var a = stops[i - 1], b = stops[i];
          var t = b[0] === a[0] ? 0 : (s - a[0]) / (b[0] - a[0]);
          return [
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t),
            Math.round(a[3] + (b[3] - a[3]) * t),
            a[4] + (b[4] - a[4]) * t
          ];
        }
      }
      var last = stops[stops.length - 1];
      return [last[1], last[2], last[3], last[4]];
    }

    function interpolate(accessor, lat, lon) {
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
        ssum += w * accessor(p);
      }
      return wsum > 0 ? ssum / wsum : 0;
    }

    function buildFieldDataUrl(accessor, stops) {
      var canvas = document.createElement('canvas');
      canvas.width = RENDER_W; canvas.height = RENDER_H;
      var ctx = canvas.getContext('2d');
      var img = ctx.createImageData(RENDER_W, RENDER_H);
      var latMin = ${CZ_BOUNDS[0][0]}, latMax = ${CZ_BOUNDS[1][0]};
      var lonMin = ${CZ_BOUNDS[0][1]}, lonMax = ${CZ_BOUNDS[1][1]};
      for (var y = 0; y < RENDER_H; y++) {
        var lat = latMax - (y / (RENDER_H - 1)) * (latMax - latMin);
        for (var x = 0; x < RENDER_W; x++) {
          var lon = lonMin + (x / (RENDER_W - 1)) * (lonMax - lonMin);
          var score = interpolate(accessor, lat, lon);
          var idx = (y * RENDER_W + x) * 4;
          if (score < FLOOR) {
            img.data[idx + 3] = 0;
          } else {
            var rgba = colorAt(stops, score);
            img.data[idx] = rgba[0]; img.data[idx + 1] = rgba[1]; img.data[idx + 2] = rgba[2];
            img.data[idx + 3] = Math.round(Math.min(1, rgba[3]) * 255);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL();
    }

    function overallAccessor(p) { return p.overall; }
    function speciesAccessor(id) { return function (p) { return p.scores[id] || 0; }; }

    function gradientCss(stops) {
      var parts = stops.map(function (s) {
        var pct = s[0];
        var a = s[4];
        return 'rgba(' + s[1] + ',' + s[2] + ',' + s[3] + ',' + a + ') ' + pct + '%';
      });
      return 'linear-gradient(to right, ' + parts.join(', ') + ')';
    }

    function updateLegend(mode) {
      var el = document.querySelector('.legend');
      if (mode.type === 'overall') {
        el.innerHTML =
          '<div class="legend-title">Šance na nález</div>' +
          '<div class="legend-bar" style="background:' + gradientCss(OVERALL_STOPS) + '"></div>' +
          '<div class="legend-labels"><span>nízká</span><span>vysoká</span></div>' +
          '<div class="legend-caption">Plocha = odhad podmínek podle počasí, půdy a lesa. Neznamená jistý nález.</div>';
      } else {
        var name = speciesNames[mode.id] || '';
        el.innerHTML =
          '<div class="legend-title">' + name + '</div>' +
          '<div class="legend-bar" style="background:' + gradientCss(SPECIES_STOPS) + '"></div>' +
          '<div class="legend-labels"><span>nízká</span><span>vysoká</span></div>' +
          '<div class="legend-caption">Plocha = odhad podmínek pro tento druh. Neznamená jistý nález.</div>';
      }
    }

    var currentLayer = null;
    function applyMode(mode) {
      var accessor = mode.type === 'overall' ? overallAccessor : speciesAccessor(mode.id);
      var stops = mode.type === 'overall' ? OVERALL_STOPS : SPECIES_STOPS;
      var url = buildFieldDataUrl(accessor, stops);
      var layer = L.imageOverlay(url, ${JSON.stringify(CZ_BOUNDS)}, {
        className: 'cloud-layer',
        interactive: false,
        opacity: 0
      });
      layer.addTo(map);
      var old = currentLayer;
      currentLayer = layer;
      // setTimeout, not requestAnimationFrame — rAF can be suspended on a
      // tab/screen that isn't actively compositing, which would silently
      // strand the crossfade at opacity 0 forever.
      setTimeout(function () {
        layer.setOpacity(1);
        if (old) setTimeout(function () { map.removeLayer(old); }, 440);
      }, 20);
      updateLegend(mode);
    }

    applyMode(${initialModeJs});

    ${userMarkerJs}

    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent) window.parent.postMessage(msg, '*');
    }

    function handleIncoming(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'setMode') applyMode(msg.mode);
      } catch (e) {
        // not our message
      }
    }
    window.addEventListener('message', function (e) { handleIncoming(e.data); });
    document.addEventListener('message', function (e) { handleIncoming(e.data); });

    map.on('click', function (e) {
      var best = null, bestDist = Infinity;
      gridPoints.forEach(function (p) {
        var d = Math.pow(p.lat - e.latlng.lat, 2) + Math.pow(p.lon - e.latlng.lng, 2);
        if (d < bestDist) { bestDist = d; best = p; }
      });
      if (!best) return;
      var topId = null, topPct = -1;
      Object.keys(best.scores).forEach(function (id) {
        if (best.scores[id] > topPct) { topPct = best.scores[id]; topId = id; }
      });
      notifyParent({
        type: 'locationSelected',
        lat: best.lat,
        lon: best.lon,
        probabilityPct: best.overall,
        topSpeciesName: topId != null ? speciesNames[topId] : null,
        topSpeciesId: topId
      });
    });
  </script>
</body>
</html>`;
}
