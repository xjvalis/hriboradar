// Real Leaflet map (OpenStreetMap + CARTO light basemap) as an HTML string,
// rendered via <iframe srcDoc> on web and react-native-webview on native.
// react-native-maps doesn't run in the web preview, so this is the one
// approach that looks identical in both places.
//
// Grid mode: each point from /api/grid becomes a soft, semi-transparent
// circle roughly the size of its grid cell (with neighbors overlapping),
// so adjacent same-tier cells visually blend into a cloud/area shape
// instead of reading as precise pins — a single point on the map would
// wrongly imply "mushrooms grow at this exact GPS coordinate", which
// isn't what the model computes.

export interface GridPoint {
  lat: number;
  lon: number;
  probabilityPct: number;
  topSpeciesName: string;
}

const CZ_BOUNDS: [[number, number], [number, number]] = [
  [48.5, 12.0],
  [51.1, 18.9],
];

function scoreColor(pct: number): { stroke: string; fill: string } {
  if (pct >= 55) return { stroke: "#4F7A3D", fill: "#4F7A3D" }; // success
  if (pct >= 28) return { stroke: "#B5652E", fill: "#B5652E" }; // accent
  return { stroke: "#A23B2E", fill: "#A23B2E" }; // danger
}

export function buildGridMapHtml(opts: {
  points: GridPoint[];
  gridSpacingM: number;
  userLat?: number;
  userLon?: number;
}) {
  const { points, gridSpacingM, userLat, userLon } = opts;
  const circleRadius = Math.round(gridSpacingM * 0.72); // overlap neighbors for a blended "cloud" look

  const circlesJs = points
    .map((p) => {
      const { fill } = scoreColor(p.probabilityPct);
      const popup = `<b>${p.topSpeciesName}</b><br/>${p.probabilityPct} % dnes`;
      return `L.circle([${p.lat},${p.lon}], {radius:${circleRadius}, color:'${fill}', weight:0, fillColor:'${fill}', fillOpacity:0.32})
        .addTo(map)
        .bindPopup(${JSON.stringify(popup)})
        .on('click', function(){ notifyParent({type:'locationSelected', lat:${p.lat}, lon:${p.lon}, probabilityPct:${p.probabilityPct}, topSpeciesName:${JSON.stringify(p.topSpeciesName)}}); });`;
    })
    .join("\n");

  const userMarkerJs =
    userLat != null && userLon != null
      ? `L.circleMarker([${userLat},${userLon}], {radius:6, color:'#24261D', weight:2, fillColor:'#EDE6D6', fillOpacity:1}).addTo(map).bindTooltip('Vaše poloha');`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F1ECDC; }
    .leaflet-popup-content { font-family: -apple-system, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true });
    map.fitBounds(${JSON.stringify(CZ_BOUNDS)});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    function notifyParent(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent) {
        window.parent.postMessage(msg, '*');
      }
    }

    ${circlesJs}
    ${userMarkerJs}
  </script>
</body>
</html>`;
}
