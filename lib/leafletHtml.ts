// Duplicated from mobile/src/leafletHtml.ts - same reasoning as species.json's two
// copies (see supabase/rostou_schema.sql history / api/data/species.json): Expo
// cannot import files from outside mobile/, so the server (api/*.ts, and
// dev-server.mjs for local dev) needs its own copy to render /api/map and
// /api/map-pin as real HTML responses. Keep both copies in sync by hand.

// Real Leaflet map (Mapy.com outdoor/aerial tiles - real forest names,
// hiking trails, and terrain, not just roads) as an HTML string, rendered
// via <iframe srcDoc> on web and react-native-webview on native.
// react-native-maps doesn't run in the web preview, so this is the one
// approach that looks identical in both places.
//
// The grid page is built ONCE per (grid data, user location) and never
// rebuilt just to switch what's being visualized - switching between
// "všechny houby" and a single species sends a postMessage into the
// already-loaded page (see applyMode/handleIncoming below), which repaints
// the overlay in place and crossfades it. Rebuilding the whole iframe/
// WebView on every chip tap would reset pan/zoom and reload every map
// tile, which is both slow and disorienting mid-interaction.
//
// Rendering: each real forest polygon (from OpenStreetMap, see /api/forest)
// gets scored on its own (IDW-interpolated from the real grid points, at
// the polygon's centroid) and filled with ONE flat color - a choropleth,
// like a fire-risk or election map, not a diffuse cloud. A blurry gradient
// blob never had a real edge to point at ("go here, not there"); a colored
// forest does. Two render paths depending on zoom: zoomed out, every
// scored polygon is rasterized onto one canvas and lightly blurred so
// nearby small forests read as one soft regional patch instead of visual
// noise; zoomed in (>= VECTOR_ZOOM_THRESHOLD), each forest in view becomes
// its own crisp Leaflet vector shape with a real, sharp boundary.
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

// Mapy.com's outdoor/aerial tile styles + the logo+copyright attribution
// their terms require (developer.mapy.com/cs/rest-api/atributovani/ -
// logo >=30px tall over the map, clickable to mapy.com, plus a copyright
// link to api.mapy.com/copyright - a plain text attribution string isn't
// enough for this provider, unlike the CARTO tiles this replaced). Shared
// between both map pages rather than duplicated inline.
const MAP_MAX_ZOOM = 16; // "see trail names and forest boundaries" ceiling -
// deliberately well short of building-level zoom, which this app has no use
// for and would otherwise let anyone zoom into (Mapy.com bills per tile,
// and finer zooms mean exponentially more tiles for the same area).

function mapyTileUrl(mapApiKey: string, mapset: "outdoor" | "aerial") {
  return `https://api.mapy.com/v1/maptiles/${mapset}/256/{z}/{x}/{y}?apikey=${mapApiKey}&lang=cs`;
}

// Mapy.com's attribution terms require the logo at >=30px tall "on a
// visible spot over the map" - too big for Leaflet's default bottom-right
// text-attribution strip (built for a one-line credit, not a logo), so
// this renders as a small dedicated bar instead, and Leaflet's own
// attribution control is turned off (attributionControl: false) to avoid
// showing two overlapping credit strips.
const MAPY_ATTRIBUTION_HTML_JS = `
      var mapyAttributionHtml =
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<a href="https://mapy.com/" target="_blank" rel="noopener">' +
            '<img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" style="height:30px;display:block" />' +
          '</a>' +
          '<span style="font-size:10px;color:#54563E">&copy; <a href="https://api.mapy.com/copyright" target="_blank" rel="noopener" style="color:#54563E">Seznam.cz a.s. a další</a></span>' +
        '</div>';
`;

export function buildPinPickerHtml(opts: { lat: number; lon: number; zoom?: number; mapApiKey: string }) {
  const { lat, lon, zoom = 13, mapApiKey } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .leaflet-marker-icon.pin { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
    .mapy-attribution { position: absolute; bottom: 6px; right: 6px; z-index: 1000; background: #F7F2E7ee;
      border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="mapy-attribution"></div>
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
    var map = L.map('map', { zoomControl: true, maxZoom: ${MAP_MAX_ZOOM}, attributionControl: false })
      .setView([${lat}, ${lon}], Math.min(${zoom}, ${MAP_MAX_ZOOM}));
    [100, 400, 1000].forEach(function (ms) {
      setTimeout(function () { map.invalidateSize(); }, ms);
    });
    ${MAPY_ATTRIBUTION_HTML_JS}
    document.querySelector('.mapy-attribution').innerHTML = mapyAttributionHtml;
    var tileErrorReported = false;
    L.tileLayer(${JSON.stringify(mapyTileUrl(mapApiKey, "outdoor"))}, {
      maxZoom: ${MAP_MAX_ZOOM}
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
  mapApiKey: string;
}) {
  const {
    points,
    speciesList,
    userLat,
    userLon,
    initialMode = { type: "overall" },
    initialView,
    apiBase = "",
    mapApiKey,
  } = opts;

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
    /* Mapy.com's outdoor style has its own real greens/browns for forest/
       terrain - competing directly with the probability overlay's own
       green-to-red scale, which used to sit on a near-neutral CARTO
       basemap. Desaturated + tinted toward the app's own background color
       so labels/trails/contours stay legible but read as a quiet backdrop,
       not a second, contradictory color signal. */
    .basemap-outdoor { filter: grayscale(0.85) sepia(0.25) saturate(0.7) brightness(1.1) contrast(0.95); }
    .legend { position: absolute; bottom: 10px; left: 10px; z-index: 1000; background: #F7F2E7ee;
      border: 1px solid #DBCFA9; border-radius: 10px; padding: 8px 10px; font: 11px -apple-system, sans-serif; color: #24261D; max-width: 200px; }
    .legend-title { font-weight: 600; font-size: 10.5px; letter-spacing: 0.4px; text-transform: uppercase; color: #54563E; margin-bottom: 5px; }
    .legend-bar { height: 9px; border-radius: 5px; }
    .legend-labels { display:flex; justify-content:space-between; font-size: 9.5px; color: #8C8A6E; margin-top: 2px; }
    .legend-caption { margin-top: 6px; font-size: 10px; color: #8C8A6E; }
    .layer-toggle { position: absolute; top: 10px; right: 10px; z-index: 1000; background: #F7F2E7ee;
      border: 1px solid #DBCFA9; border-radius: 999px; padding: 6px 12px; font: 600 11px -apple-system, sans-serif;
      color: #24261D; }
    .mapy-attribution { position: absolute; bottom: 10px; right: 10px; z-index: 1000; background: #F7F2E7ee;
      border-radius: 6px; padding: 2px 6px; }
    .hotspot { position: relative; }
    .hotspot-dot { position: absolute; top: 4px; left: 4px; width: 6px; height: 6px; border-radius: 50%;
      box-shadow: 0 0 0 1.5px #F7F2E7; }
    .hotspot-ring { position: absolute; top: 0; left: 0; width: 14px; height: 14px; border-radius: 50%;
      opacity: 0.65; animation: hotspot-pulse 2s ease-out infinite; }
    @keyframes hotspot-pulse {
      0% { transform: scale(0.5); opacity: 0.6; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    /* Override Leaflet's default tooltip chrome (white box, generic
       sans-serif, thin gray border) so the hotspot popup reads as part of
       the app, not as browser furniture - same cream/ink pairing and pill
       shape as .legend above, not a mismatched system dialog. */
    .app-tooltip { background: #F7F2E7; color: #24261D; border: 1px solid #DBCFA9; border-radius: 8px;
      padding: 5px 10px; font: 600 12px -apple-system, sans-serif; box-shadow: 0 2px 8px rgba(36,38,29,0.18); }
    .app-tooltip::before { border-top-color: #DBCFA9; }
    /* Real download progress for /api/forest (the dominant byte cost of
       opening the map - see loadForestData) so a genuinely slow connection
       shows a number that's actually moving, not a decorative spinner. */
    .forest-loading { position: absolute; inset: 0; z-index: 2000; background: #EDE6D6;
      display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .forest-loading-text { font: 13px -apple-system, sans-serif; color: #54563E; margin-bottom: 10px; }
    .forest-loading-pct { font: 700 26px -apple-system, sans-serif; color: #4F7A3D; }
    .forest-loading-track { width: 160px; height: 5px; border-radius: 999px; background: #DBCFA9;
      margin-top: 8px; overflow: hidden; }
    .forest-loading-fill { height: 100%; width: 0%; background: #4F7A3D; border-radius: 999px;
      transition: width 150ms linear; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend"></div>
  <div class="layer-toggle"></div>
  <div class="mapy-attribution"></div>
  <div class="forest-loading" id="forestLoading">
    <div class="forest-loading-text">Stahuji data o lesích…</div>
    <div class="forest-loading-pct" id="forestLoadingPct">0 %</div>
    <div class="forest-loading-track"><div class="forest-loading-fill" id="forestLoadingFill"></div></div>
  </div>
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
      
      var map = L.map('map', { zoomControl: true, maxZoom: ${MAP_MAX_ZOOM}, attributionControl: false });
      var initialView = ${initialViewJs};
      // App.tsx keeps every screen mounted permanently, just hidden via
      // display:none - which means this page can (and normally does) run
      // its whole init, including this very fitBounds call, while its
      // container is display:none and therefore 0x0. Leaflet fits a
      // zero-size box to the "whole world, zoomed all the way out" view,
      // and nothing afterwards corrects the ZOOM (invalidateSize below
      // fixes rendering/panning math, not the zoom level it already
      // committed to). didInitialFit tracks whether a *real*, correctly-
      // sized fit has happened yet; refreshView (sent once the host app
      // confirms this screen is actually visible - see reportLocation's
      // sibling handlers below) redoes it exactly once a real size exists,
      // without disturbing the user's own pan/zoom on every later visit.
      var didInitialFit = !!initialView;
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
      
      ${MAPY_ATTRIBUTION_HTML_JS}
      document.querySelector('.mapy-attribution').innerHTML = mapyAttributionHtml;
      var tileErrorReported = false;
      function reportTileError() {
        if (tileErrorReported) return;
        tileErrorReported = true;
        notifyParent({ type: 'tileError' });
      }
      var outdoorLayer = L.tileLayer(${JSON.stringify(mapyTileUrl(mapApiKey, "outdoor"))}, {
        maxZoom: ${MAP_MAX_ZOOM},
        className: 'basemap-outdoor'
      }).on('tileerror', reportTileError);
      var aerialLayer = L.tileLayer(${JSON.stringify(mapyTileUrl(mapApiKey, "aerial"))}, {
        maxZoom: ${MAP_MAX_ZOOM}
      }).on('tileerror', reportTileError);

      var activeBaseLayer = outdoorLayer;
      activeBaseLayer.addTo(map);

      var toggleEl = document.querySelector('.layer-toggle');
      function renderToggle() {
        toggleEl.textContent = activeBaseLayer === outdoorLayer ? 'Satelitní' : 'Turistická';
      }
      toggleEl.addEventListener('click', function () {
        map.removeLayer(activeBaseLayer);
        activeBaseLayer = activeBaseLayer === outdoorLayer ? aerialLayer : outdoorLayer;
        activeBaseLayer.addTo(map);
        renderToggle();
      });
      renderToggle();

      var gridPoints = ${pointsJs};
      var speciesNames = ${speciesNamesJs};
      var API_BASE = ${apiBaseJs};

      var FLOOR = 20;
      var CUTOFF_DEG = 0.30;
      var MASK_W = 1600, MASK_H = 614; // raster resolution for the zoomed-out path
      var VECTOR_ZOOM_THRESHOLD = 12; // >= this: precise per-forest shapes; below: merged raster

      // Leaflet displays everything in Web Mercator, where meridians are
      // evenly spaced but parallels are not - sampling latitude linearly
      // drifts from the real basemap by a few km once you compare against
      // something with a real edge, like a forest boundary. These convert
      // between latitude and the map's actual projected Y so the raster's
      // rows/columns line up with where Leaflet will actually place it.
      function mercY(latDeg) {
        var rad = (latDeg * Math.PI) / 180;
        return Math.log(Math.tan(Math.PI / 4 + rad / 2));
      }
      function mercYToLat(y) {
        return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
      }
      var MERC_Y_MIN = mercY(${CZ_BOUNDS[0][0]}), MERC_Y_MAX = mercY(${CZ_BOUNDS[1][0]});

      function project(lat, lon) {
        var lonMin = ${CZ_BOUNDS[0][1]}, lonMax = ${CZ_BOUNDS[1][1]};
        var x = (lon - lonMin) / (lonMax - lonMin) * MASK_W;
        var y = (MERC_Y_MAX - mercY(lat)) / (MERC_Y_MAX - MERC_Y_MIN) * MASK_H;
        return [x, y];
      }

      // Real OpenStreetMap forest/wood polygons (fetched once, cached
      // server-side, see /api/forest) - centroid + bounding box precomputed
      // once per polygon so scoring and viewport culling stay cheap on
      // every mode switch / pan / zoom afterward.
      var polyMeta = null;
      var forestReady = false;

      function preparePolygons(polygons) {
        return polygons.map(function (rings) {
          var outer = rings[0];
          var sumLat = 0, sumLon = 0;
          var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          for (var i = 0; i < outer.length; i++) {
            var lat = outer[i][0], lon = outer[i][1];
            sumLat += lat; sumLon += lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
          }
          return {
            rings: rings,
            centroid: [sumLat / outer.length, sumLon / outer.length],
            bbox: [minLat, minLon, maxLat, maxLon]
          };
        });
      }

      // Real bytes-received progress (XHR onprogress - fetch() doesn't
      // expose this reliably across WebView/browser) for the biggest single
      // download this page makes (~1.3MB compressed in production - real
      // country-wide polygon data, cached by the browser/WebView after the
      // first load). Vercel serves this brotli-encoded with chunked
      // transfer, no Content-Length, so lengthComputable is false -
      // ESTIMATED_FOREST_BYTES (measured against the real production
      // response, 2026-08-26) stands in for the total. Still real bytes
      // actually arriving, not a timer pretending to be busy - the whole
      // point on a genuinely slow connection out in an actual forest.
      var ESTIMATED_FOREST_BYTES = 1400000;
      function setForestProgress(pct) {
        var pctEl = document.getElementById('forestLoadingPct');
        var fillEl = document.getElementById('forestLoadingFill');
        if (pctEl) pctEl.textContent = pct + ' %';
        if (fillEl) fillEl.style.width = pct + '%';
      }
      function hideForestLoading() {
        var el = document.getElementById('forestLoading');
        if (el) el.style.display = 'none';
      }

      function loadForestData(cb) {
        var url = (API_BASE || '') + '/api/forest';
        var timedOut = false;
        // Generous on purpose: this data isn't optional scenery anymore, it
        // IS the map now - without it there's nothing to color at all.
        var timer = setTimeout(function () {
          timedOut = true;
          hideForestLoading();
          cb();
        }, 15000);

        function finish(data) {
          if (timedOut) return;
          clearTimeout(timer);
          setForestProgress(100);
          hideForestLoading();
          if (data) polyMeta = preparePolygons(data.polygons || []);
          forestReady = !!data;
          cb();
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onprogress = function (e) {
          var total = e.lengthComputable && e.total > 0 ? e.total : ESTIMATED_FOREST_BYTES;
          setForestProgress(Math.min(99, Math.round((e.loaded / total) * 100)));
        };
        xhr.onload = function () {
          if (xhr.status < 200 || xhr.status >= 300) { finish(null); return; }
          try {
            finish(JSON.parse(xhr.responseText));
          } catch (e) {
            finish(null);
          }
        };
        xhr.onerror = function () { finish(null); };
        xhr.send();
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

      // One score+color per forest polygon (not per pixel), computed ONCE
      // per mode switch and reused by the raster, vector, and hotspot
      // renderers below (previously each of them called interpolate() -
      // the expensive part, ~500 grid points per polygon - separately, so
      // switching a chip or panning while zoomed in did the same ~36k-
      // polygon scoring pass 2-3x over. A polygon either qualifies (real
      // fill color) or doesn't (skipped, same FLOOR cutoff the old smooth
      // field used).
      function computeScored(accessor, stops) {
        var out = [];
        for (var i = 0; i < polyMeta.length; i++) {
          var poly = polyMeta[i];
          var score = interpolate(accessor, poly.centroid[0], poly.centroid[1]);
          if (score < FLOOR) continue;
          out.push({ poly: poly, score: score, rgba: colorAt(stops, score) });
        }
        return out;
      }

      function fillPolygonPath(ctx, poly) {
        ctx.beginPath();
        var rings = poly.rings;
        for (var r = 0; r < rings.length; r++) {
          var ring = rings[r];
          for (var p = 0; p < ring.length; p++) {
            var xy = project(ring[p][0], ring[p][1]);
            if (p === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]);
          }
          ctx.closePath();
        }
      }

      // Zoomed-out path: every scored polygon rasterized onto one canvas,
      // then blurred (blurForZoom) - small nearby forests with similar
      // scores melt into one soft regional patch instead of a field of
      // tiny, hard-edged confetti, while still being real forest shapes
      // underneath (not a fabricated blob).
      function buildScoredRaster(scored) {
        var canvas = document.createElement('canvas');
        canvas.width = MASK_W; canvas.height = MASK_H;
        var ctx = canvas.getContext('2d');
        for (var i = 0; i < scored.length; i++) {
          var entry = scored[i];
          ctx.fillStyle = 'rgba(' + entry.rgba[0] + ',' + entry.rgba[1] + ',' + entry.rgba[2] + ',' + Math.min(1, entry.rgba[3]) + ')';
          fillPolygonPath(ctx, entry.poly);
          ctx.fill('evenodd');
        }
        return canvas;
      }

      // Zoomed-in path: real Leaflet vector shapes, one per forest, with a
      // genuine sharp boundary - viewport-culled (via each polygon's
      // precomputed bbox) so cost stays tied to what's on screen, not the
      // full ~36k-polygon dataset, and rebuilt on pan so panning into a new
      // area picks up its forests instead of staying blank.
      var vectorRenderer = L.canvas();
      var vectorLayerGroup = null;
      function rebuildVectorLayer(scored) {
        var old = vectorLayerGroup;
        vectorLayerGroup = L.layerGroup();
        var b = map.getBounds();
        var minLat = b.getSouth(), maxLat = b.getNorth(), minLon = b.getWest(), maxLon = b.getEast();
        for (var i = 0; i < scored.length; i++) {
          var entry = scored[i];
          var bbox = entry.poly.bbox; // [minLat, minLon, maxLat, maxLon]
          if (bbox[2] < minLat || bbox[0] > maxLat || bbox[3] < minLon || bbox[1] > maxLon) continue;
          var color = 'rgb(' + entry.rgba[0] + ',' + entry.rgba[1] + ',' + entry.rgba[2] + ')';
          L.polygon(entry.poly.rings, {
            renderer: vectorRenderer,
            stroke: false,
            fillColor: color,
            fillOpacity: Math.min(1, entry.rgba[3]),
            interactive: false
          }).addTo(vectorLayerGroup);
        }
        vectorLayerGroup.addTo(map);
        if (old) map.removeLayer(old);
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

      // Wide-out view reads better softened into regional patches (the
      // exact edge of one small forest isn't the point at that scale);
      // zoomed in, real forest edges should read crisp - that contrast is
      // what makes it feel like it "resolves into focus" as you zoom.
      function blurForZoom(z) {
        if (z <= 8) return 3.5;
        if (z <= 10) return 1.8;
        return 0.6;
      }

      var currentRasterLayer = null;
      var currentScored = null, currentMode = null;

      function renderForZoom(forceRebuild) {
        if (!currentScored) return;
        var z = map.getZoom();
        if (z >= VECTOR_ZOOM_THRESHOLD) {
          if (currentRasterLayer) { map.removeLayer(currentRasterLayer); currentRasterLayer = null; }
          rebuildVectorLayer(currentScored);
        } else {
          if (vectorLayerGroup) { map.removeLayer(vectorLayerGroup); vectorLayerGroup = null; }
          // The raster image itself only depends on currentScored (the
          // mode), not on zoom - only the blur amount does. Re-rasterizing
          // ~20k+ polygon fills on every zoomend (pinch-zooming fires this
          // repeatedly) was the main thing making the map feel laggy on a
          // real phone; once the current mode's image already exists,
          // zooming just adjusts its blur in place instead of rebuilding.
          if (currentRasterLayer && !forceRebuild) {
            var existingEl = currentRasterLayer.getElement();
            if (existingEl) existingEl.style.filter = 'blur(' + blurForZoom(z) + 'px)';
            return;
          }
          var url = buildScoredRaster(currentScored).toDataURL();
          var layer = L.imageOverlay(url, ${JSON.stringify(CZ_BOUNDS)}, {
            className: 'cloud-layer',
            interactive: false,
            opacity: 0
          });
          layer.addTo(map);
          var layerEl = layer.getElement();
          if (layerEl) layerEl.style.filter = 'blur(' + blurForZoom(z) + 'px)';
          var old = currentRasterLayer;
          currentRasterLayer = layer;
          setTimeout(function () {
            layer.setOpacity(1);
            if (old) setTimeout(function () { map.removeLayer(old); }, 440);
          }, 20);
        }
      }

      // Same wording tiers as theme.ts's scoreTier/scoreLabel on the native
      // side (55/28 breakpoints) - a raw "60.00000001%" (interpolate()'s
      // floating-point weighted average, never rounded) read as a bug, not
      // a feature, and a bare number doesn't say anything a first-time
      // user immediately understands anyway.
      function tierLabel(score) {
        if (score >= 55) return 'Vysoká šance na nález';
        if (score >= 28) return 'Slušná šance na nález';
        return 'Nízká šance na nález';
      }

      // A handful of pulsing markers at the best-scoring forests, on top of
      // whichever fill mode is active - the fill answers "where's decent
      // vs not," this answers "no really, look HERE first" without making
      // anyone compare shades of green. Capped low on purpose: this only
      // works as a spotlight if it stays rare.
      var HOTSPOT_COUNT = 6;
      var hotspotMarkers = [];
      function renderHotspots(scored, mode) {
        hotspotMarkers.forEach(function (m) { map.removeLayer(m); });
        hotspotMarkers = [];
        var top = scored.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, HOTSPOT_COUNT);
        top.forEach(function (entry) {
          var color = 'rgb(' + entry.rgba[0] + ',' + entry.rgba[1] + ',' + entry.rgba[2] + ')';
          var icon = L.divIcon({
            className: 'hotspot',
            html:
              '<span class="hotspot-ring" style="background:' + color + '"></span>' +
              '<span class="hotspot-dot" style="background:' + color + '"></span>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });
          var marker = L.marker(entry.poly.centroid, { icon: icon, keyboard: false });
          // Same as tapping the map at this spot (see map.on('click', ...)
          // below) - a pulsing dot with no way to find out what it actually
          // is was the whole complaint this replaced; tapping now opens the
          // real detail sheet for that exact forest.
          var text = mode.type === 'overall'
            ? tierLabel(entry.score)
            : (speciesNames[mode.id] || '') + ' — ' + tierLabel(entry.score);
          marker.bindTooltip(text, { direction: 'top', offset: [0, -8], className: 'app-tooltip' });
          marker.on('click', function () {
            reportLocation(entry.poly.centroid[0], entry.poly.centroid[1]);
          });
          marker.addTo(map);
          hotspotMarkers.push(marker);
        });
      }

      function applyMode(mode) {
        currentMode = mode;
        var accessor = mode.type === 'overall' ? overallAccessor : speciesAccessor(mode.id);
        var stops = mode.type === 'overall' ? OVERALL_STOPS : SPECIES_STOPS;
        currentScored = computeScored(accessor, stops);
        renderForZoom(true);
        renderHotspots(currentScored, mode);
        updateLegend(mode);
      }

      map.on('zoomend', function () { renderForZoom(false); });
      // Raster mode already covers the whole country in one image, so only
      // vector mode needs to react to panning - it's viewport-culled by
      // design, so moving into a new area means loading that area's
      // forests, not just re-showing what was already there.
      map.on('moveend', function () {
        if (map.getZoom() >= VECTOR_ZOOM_THRESHOLD && vectorLayerGroup && currentScored) {
          rebuildVectorLayer(currentScored);
        }
      });

      ${userMarkerJs}

      // First paint waits for the real forest data (fetch has its own
      // timeout, see loadForestData) so there's never a flash of the old
      // unmasked "everything is green" rendering before it settles in.
      loadForestData(function () {
        applyMode(${initialModeJs});
        notifyParent({ type: 'ready' });
      });

      function handleIncoming(raw) {
        try {
          var msg = JSON.parse(raw);
          if (msg.type === 'setMode') applyMode(msg.mode);
          else if (msg.type === 'setSavedLocations') renderSavedLocations(msg.locations);
          // Re-pans an already-loaded map to a new region (e.g. a second
          // "Kam dnes?" tap after the map screen was kept mounted and
          // warm from an earlier visit) - initialView only covers the
          // very first page load, baked into the URL/HTML itself.
          else if (msg.type === 'focusView') {
            map.invalidateSize();
            map.setView([msg.lat, msg.lon], msg.zoom || 10);
            didInitialFit = true;
          }
          // Sent every time the host app confirms this screen just became
          // visible - see the didInitialFit comment above for why the very
          // first one needs to redo the fit, not just invalidateSize.
          else if (msg.type === 'refreshView') {
            map.invalidateSize();
            if (!didInitialFit) {
              applyInitialView();
              didInitialFit = true;
            }
          }
        } catch (e) {
          // not our message
        }
      }
      window.addEventListener('message', function (e) { handleIncoming(e.data); });
      document.addEventListener('message', function (e) { handleIncoming(e.data); });

      function reportLocation(lat, lon, savedLabel) {
        var best = null, bestDist = Infinity;
        gridPoints.forEach(function (p) {
          var d = Math.pow(p.lat - lat, 2) + Math.pow(p.lon - lon, 2);
          if (d < bestDist) { bestDist = d; best = p; }
        });
        if (!best) return;
        var topId = null, topPct = -1;
        Object.keys(best.scores).forEach(function (id) {
          if (best.scores[id] > topPct) { topPct = best.scores[id]; topId = id; }
        });
        notifyParent({
          type: 'locationSelected',
          // The exact tapped/marker point - shown to the user and used for
          // the Mapy.cz deep link, so it must be the real spot, not the
          // (up to ~15km away) weather-grid point snapped to below. Every
          // tap inside the same grid cell used to report the identical
          // grid.lat/lon, which made the Mapy.cz pin look "stuck" on one
          // spot no matter where in a region you actually clicked.
          lat: lat,
          lon: lon,
          // Forecast data still comes from the nearest grid point (that's
          // the real resolution weather data exists at) - gridLat/gridLon
          // let the app re-fetch from the same cached point instead of
          // hitting a fresh, uncached coordinate for every distinct tap.
          gridLat: best.lat,
          gridLon: best.lon,
          probabilityPct: best.overall,
          topSpeciesName: topId != null ? speciesNames[topId] : null,
          topSpeciesId: topId,
          // Only set when this came from tapping a saved-location marker -
          // lets the sheet show the user's own name for the spot ("Chalupa")
          // instead of the algorithmic nearest-tourist-area guess.
          savedLabel: savedLabel || null
        });
      }
      map.on('click', function (e) { reportLocation(e.latlng.lat, e.latlng.lng); });

      // Pins for the user's own saved locations (Moje místa) - sent in via
      // postMessage rather than baked into the initial HTML, since the
      // native WebView loads this page from the public, unauthenticated
      // /api/map endpoint and has no way to know the signed-in user's list
      // at render time. Distinct terracotta pin (palette.accent) so it
      // reads as "yours", not just another hotspot or the basemap's own
      // POI icons.
      var savedMarkers = [];
      function renderSavedLocations(locations) {
        savedMarkers.forEach(function (m) { map.removeLayer(m); });
        savedMarkers = [];
        (locations || []).forEach(function (loc) {
          var icon = L.divIcon({
            className: 'saved-pin',
            html:
              '<svg width="22" height="30" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="#B5652E"/>' +
              '<circle cx="15" cy="15" r="6" fill="#F7F2E7"/></svg>',
            iconSize: [22, 30],
            iconAnchor: [11, 30]
          });
          var marker = L.marker([loc.lat, loc.lon], { icon: icon, keyboard: false, zIndexOffset: 500 });
          marker.bindTooltip(loc.label, { direction: 'top', offset: [0, -26], className: 'app-tooltip' });
          marker.on('click', function () { reportLocation(loc.lat, loc.lon, loc.label); });
          marker.addTo(map);
          savedMarkers.push(marker);
        });
      }
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
