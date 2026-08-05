// Lightweight local stand-in for `vercel dev` (which needs `vercel login`).
// Serves the same api/*.ts handlers over plain HTTP for local app
// development. Not used in production — Vercel serves api/ directly once
// the repo is connected on vercel.com.
import http from "node:http";
import { URL } from "node:url";
import { buildGridMapHtml } from "./mobile/src/leafletHtml.ts";

const routes = {
  "/api/predict": (await import("./api/predict.ts")).default,
  "/api/forecast": (await import("./api/forecast.ts")).default,
  "/api/grid": (await import("./api/grid.ts")).default,
  "/api/geocode": (await import("./api/geocode.ts")).default,
  "/api/observations": (await import("./api/observations.ts")).default,
};

const PORT = 3001;

// Serves the same Leaflet page previously passed to react-native-webview via
// the `source={{ html }}` prop — inline HTML of this size (Leaflet itself
// plus every grid point) turned out to silently fail on a real iPhone,
// almost certainly a react-native-webview/RN-bridge limit on that prop, not
// an error WebView ever reports. Loading it as a normal fetched page (like
// any other website) sidesteps whatever that limit is entirely, since the
// content never has to cross the bridge as a single JS string.
async function getGridData() {
  return new Promise((resolve, reject) => {
    const captureRes = {
      status() {
        return this;
      },
      json: resolve,
    };
    Promise.resolve(routes["/api/grid"]({ query: {} }, captureRes)).catch(reject);
  });
}

async function readJsonBody(nodeReq) {
  if (nodeReq.method !== "POST") return undefined;
  const chunks = [];
  for await (const chunk of nodeReq) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function makeRes(nodeRes) {
  return {
    _status: 200,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      nodeRes.writeHead(this._status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      nodeRes.end(JSON.stringify(body));
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/map") {
    try {
      const grid = await getGridData();
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      const html = buildGridMapHtml({
        points: grid.points,
        speciesList: grid.speciesList,
        userLat: lat ? Number(lat) : undefined,
        userLon: lon ? Number(lon) : undefined,
      });
      res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(String(err));
    }
    return;
  }

  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const query = Object.fromEntries(url.searchParams);
  try {
    const body = await readJsonBody(req);
    await handler({ query, body, method: req.method }, makeRes(res));
  } catch (err) {
    res.writeHead(500, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`Dev API server on http://localhost:${PORT}`);
  console.log("Routes:", Object.keys(routes).join(", "));
});
