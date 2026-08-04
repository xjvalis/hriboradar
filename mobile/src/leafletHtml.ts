// Real Leaflet map (OpenStreetMap + CARTO light basemap) as an HTML string,
// rendered via <iframe srcDoc> on web and react-native-webview on native.
// This is the same stack the kderostouhouby.cz reference actually uses —
// react-native-maps doesn't run in the web preview, so this is the one
// approach that looks identical in both places.
export function buildMapHtml(opts: {
  lat: number;
  lon: number;
  probabilityPct?: number;
  topSpeciesName?: string;
}) {
  const { lat, lon, probabilityPct, topSpeciesName } = opts;
  const popup =
    probabilityPct != null
      ? `<b>${topSpeciesName ?? "Nejvyšší šance"}</b><br/>${probabilityPct} % dnes`
      : "Vaše poloha";

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
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lon}], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);
    var marker = L.circleMarker([${lat}, ${lon}], {
      radius: 10, color: '#3F5E2C', fillColor: '#8FAB4E', fillOpacity: 0.85, weight: 2
    }).addTo(map);
    marker.bindPopup(${JSON.stringify(popup)}).openPopup();
  </script>
</body>
</html>`;
}
