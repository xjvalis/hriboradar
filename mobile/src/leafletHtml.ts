// Real Leaflet map (OpenStreetMap tiles, CARTO light basemap) as an HTML
// string, rendered via <iframe srcDoc> on web and react-native-webview on
// native. react-native-maps doesn't run in the web preview, so this is the
// one approach that looks identical in both places.
//
// The grid page is built ONCE per (grid data, user location) and never
// rebuilt just to switch what's being visualized - switching between
// "všechny houby" and a single species sends a postMessage into the
// already-loaded page (see applyMode/handleIncoming below), which repaints
// the overlay in place and crossfades it. Rebuilding the whole iframe/
// WebView on every chip tap would reset pan/zoom and reload every map
// tile, which is both slow and disorienting mid-interaction.
//
// Rendering: per-pixel inverse-distance-weighted interpolation from the
// real grid points, rasterized to an offscreen <canvas>, dropped on the
// map as a georeferenced image overlay (+ light CSS blur for organic
// softness). A short cutoff radius keeps influence local, so real gaps
// between regions stay gaps (disconnected islands) instead of the whole
// country reading as one continuous wash.
import { LEAFLET_CSS, LEAFLET_JS } from "./leafletAssets";

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

export function buildPinPickerHtml(opts: { lat: number; lon: number; zoom?: number }) {
  const { lat, lon, zoom = 13 } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .leaflet-marker-icon.pin { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent) window.parent.postMessage(msg, '*');
    }
    window.onerror = function (message, source, lineno) {
      notifyParent({ type: 'jsError', message: String(message) + ' (' + source + ':' + lineno + ')' });
    };
  </script>
  <script>${LEAFLET_JS}</script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lon}], ${zoom});
    [100, 400, 1000].forEach(function (ms) {
      setTimeout(function () { map.invalidateSize(); }, ms);
    });
    var tileErrorReported = false;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).on('tileerror', function () {
      if (tileErrorReported) return;
      tileErrorReported = true;
      notifyParent({ type: 'tileError' });
    }).addTo(map);

    var pinIcon = L.divIcon({
      className: 'pin',
      html: '<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="#33482C"/>' +
        '<circle cx="15" cy="15" r="6" fill="#EDE6D6"/></svg>',
      iconSize: [30, 40],
      iconAnchor: [15, 40]
    });

    var marker = L.marker([${lat}, ${lon}], { icon: pinIcon, draggable: true }).addTo(map);

    function movePin(lat, lon) {
      marker.setLatLng([lat, lon]);
      notifyParent({ type: 'pinMoved', lat: lat, lon: lon });
    }

    marker.on('dragend', function () {
      var p = marker.getLatLng();
      notifyParent({ type: 'pinMoved', lat: p.lat, lon: p.lng });
    });
    map.on('click', function (e) { movePin(e.latlng.lat, e.latlng.lng); });

    function handleIncoming(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'recenter') {
          map.setView([msg.lat, msg.lon], msg.zoom || 15);
          movePin(msg.lat, msg.lon);
        }
      } catch (e) {
        // not our message
      }
    }
    window.addEventListener('message', function (e) { handleIncoming(e.data); });
    document.addEventListener('message', function (e) { handleIncoming(e.data); });

    notifyParent({ type: 'ready' });
  </script>
</body>
</html>`;
}

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
}

export function buildGridMapHtml(opts: {
  points: GridPoint[];
  speciesList: SpeciesRef[];
  userLat?: number;
  userLon?: number;
  initialMode?: MapMode;
  initialView?: MapView;
  apiBase?: string;
}) {
  const { points, speciesList, userLat, userLon, initialMode = { type: "overall" }, initialView, apiBase = "" } =
    opts;

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
  const initialViewJs = JSON.stringify(initialView ?? null);
  const apiBaseJs = JSON.stringify(apiBase);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F1ECDC; overflow: hidden; }
    #map { position: absolute; top: 0; left: 0; }
    .cloud-layer { transition: opacity 420ms ease, filter 420ms ease; }
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
  <script>
    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent) window.parent.postMessage(msg, '*');
    }
    window.onerror = function (message, source, lineno) {
      notifyParent({ type: 'jsError', message: String(message) + ' (' + source + ':' + lineno + ')' });
    };
  </script>
  <script>${LEAFLET_JS}</script>
  <script>
    // CRITICAL: Initialize map ONLY after small delay to ensure DOM is laid out
    // Native WebView measures #map size at script execution time, often getting 0x0
    var mapInitialized = false;
    
    function initializeMap() {
      if (mapInitialized) return;
      mapInitialized = true;
      
      var mapEl = document.getElementById('map');
      console.log('[Map Init] Container size:', mapEl.clientWidth, 'x', mapEl.clientHeight);
      
      var map = L.map('map', { zoomControl: true });
      var initialView = ${initialViewJs};
      function applyInitialView() {
        if (initialView) map.setView([initialView.lat, initialView.lon], initialView.zoom);
        else map.fitBounds(${JSON.stringify(CZ_BOUNDS)});
      }
      applyInitialView();

      // Aggressive invalidation for native WebView - runs many times to catch size changes
      [10, 50, 100, 200, 400, 800, 1200].forEach(function (ms) {
        setTimeout(function () {
          console.log('[Map Init] invalidateSize at', ms, 'ms');
          map.invalidateSize();
          applyInitialView();
        }, ms);
      });
      
      var tileErrorReported = false;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      }).on('tileerror', function () {
        if (tileErrorReported) return;
        tileErrorReported = true;
        notifyParent({ type: 'tileError' });
      }).addTo(map);

      var gridPoints = ${pointsJs};
      var speciesNames = ${speciesNamesJs};
      var API_BASE = ${apiBaseJs};

      var FLOOR = 20;
      var CUTOFF_DEG = 0.30;
      var RENDER_W = 340, RENDER_H = 130;

      // Leaflet displays everything in Web Mercator, where meridians are
      // evenly spaced but parallels are not - a raster built by sampling
      // latitude linearly (which is what this used to do, and still looks
      // fine zoomed out on a whole-country wash with no real geography to
      // compare against) drifts from the real basemap by a few km once you
      // zoom into a neighborhood and compare against something with a real
      // edge, like a forest boundary. These convert between latitude and
      // the map's actual projected Y so the raster's rows/columns line up
      // with where Leaflet will actually place the image.
      function mercY(latDeg) {
        var rad = (latDeg * Math.PI) / 180;
        return Math.log(Math.tan(Math.PI / 4 + rad / 2));
      }
      function mercYToLat(y) {
        return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
      }

      // Forest mask: the probability field above is a smooth interpolation
      // between a few hundred grid points, so at low resolution it reads
      // fine zoomed out but "floods" everything (cities included) once you
      // zoom in - there's no real geography in it. This clips the field to
      // real OpenStreetMap forest/wood polygons (fetched once, cached
      // server-side, see /api/forest) so color only ever appears where
      // there's actually forest, at a resolution sharp enough to show real
      // forest-patch boundaries when zoomed into a town.
      var MASK_W = 1600, MASK_H = 614;
      var forestMaskCanvas = null;
      var forestReady = false;

      var MERC_Y_MIN = mercY(${CZ_BOUNDS[0][0]}), MERC_Y_MAX = mercY(${CZ_BOUNDS[1][0]});

      function project(lat, lon) {
        var lonMin = ${CZ_BOUNDS[0][1]}, lonMax = ${CZ_BOUNDS[1][1]};
        var x = (lon - lonMin) / (lonMax - lonMin) * MASK_W;
        var y = (MERC_Y_MAX - mercY(lat)) / (MERC_Y_MAX - MERC_Y_MIN) * MASK_H;
        return [x, y];
      }

      function buildForestMask(polygons) {
        var canvas = document.createElement('canvas');
        canvas.width = MASK_W; canvas.height = MASK_H;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        for (var i = 0; i < polygons.length; i++) {
          var rings = polygons[i];
          ctx.beginPath();
          for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            for (var p = 0; p < ring.length; p++) {
              var xy = project(ring[p][0], ring[p][1]);
              if (p === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]);
            }
            ctx.closePath();
          }
          ctx.fill('evenodd');
        }
        return canvas;
      }

      function loadForestMask(cb) {
        var url = (API_BASE || '') + '/api/forest';
        var timedOut = false;
        // The forest dataset is a few MB (real country-wide polygon data) -
        // cached by the browser/WebView after the first load, but that
        // first fetch+parse can genuinely take a while on a slow mobile
        // connection (exactly the kind of spotty signal you get out in an
        // actual forest). Generous on purpose: a late mask is much better
        // than silently falling back to the unmasked "everything is green"
        // rendering this whole feature exists to avoid.
        var timer = setTimeout(function () {
          timedOut = true;
          cb();
        }, 15000);
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (timedOut) return;
            clearTimeout(timer);
            forestMaskCanvas = buildForestMask(data.polygons || []);
            forestReady = true;
            cb();
          })
          .catch(function () {
            if (timedOut) return;
            clearTimeout(timer);
            cb();
          });
      }

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
          var dlon = (p.lon - lon) * 0.66;
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
        var lonMin = ${CZ_BOUNDS[0][1]}, lonMax = ${CZ_BOUNDS[1][1]};
        for (var y = 0; y < RENDER_H; y++) {
          var lat = mercYToLat(MERC_Y_MAX - (y / (RENDER_H - 1)) * (MERC_Y_MAX - MERC_Y_MIN));
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

        if (!forestMaskCanvas) {
          // Forest data unavailable (fetch failed/timed out) - fall back to
          // the plain unmasked field rather than blocking the map forever.
          return canvas.toDataURL();
        }

        var masked = document.createElement('canvas');
        masked.width = MASK_W; masked.height = MASK_H;
        var mctx = masked.getContext('2d');
        mctx.imageSmoothingEnabled = true;
        mctx.drawImage(canvas, 0, 0, MASK_W, MASK_H);
        mctx.globalCompositeOperation = 'destination-in';
        mctx.drawImage(forestMaskCanvas, 0, 0);
        return masked.toDataURL();
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
        var layerEl = layer.getElement();
        if (layerEl) layerEl.style.filter = 'blur(' + blurForZoom(map.getZoom()) + 'px)';
        var old = currentLayer;
        currentLayer = layer;
        setTimeout(function () {
          layer.setOpacity(1);
          if (old) setTimeout(function () { map.removeLayer(old); }, 440);
        }, 20);
        updateLegend(mode);
      }

      // Wide-out view reads better softened into regional blobs (the exact
      // edge of one small forest patch isn't the point at that scale); once
      // zoomed in, the forest-mask edges should read crisp - that contrast
      // is what makes it feel like it "resolves into focus" as you zoom.
      function blurForZoom(z) {
        if (z <= 8) return 3.5;
        if (z <= 10) return 1.8;
        if (z <= 12) return 0.6;
        return 0;
      }
      map.on('zoomend', function () {
        if (!currentLayer) return;
        var el = currentLayer.getElement();
        if (el) el.style.filter = 'blur(' + blurForZoom(map.getZoom()) + 'px)';
      });

      ${userMarkerJs}

      // First paint waits for the forest mask (fetch has its own timeout,
      // see loadForestMask) so we never show the old unmasked "everything
      // is green" flash before it settles in.
      loadForestMask(function () {
        applyMode(${initialModeJs});
        notifyParent({ type: 'ready' });
      });

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
    }
    
    // Wait for DOM to be fully laid out before initializing Leaflet
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeMap);
    } else {
      setTimeout(initializeMap, 50);
    }
  </script>
</body>
</html>`;
}
