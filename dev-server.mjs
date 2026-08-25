// Lightweight local stand-in for `vercel dev` (which needs `vercel login`).
// Serves the same api/*.ts handlers over plain HTTP for local app
// development. Not used in production - Vercel serves api/ directly once
// the repo is connected on vercel.com.
import http from "node:http";
import { URL } from "node:url";

const routes = {
  "/api/forecast": (await import("./api/forecast.ts")).default,
  "/api/grid": (await import("./api/grid.ts")).default,
  "/api/map": (await import("./api/map.ts")).default,
  "/api/map-pin": (await import("./api/map-pin.ts")).default,
  "/api/geocode": (await import("./api/geocode.ts")).default,
  "/api/feedback": (await import("./api/feedback.ts")).default,
  "/api/cron/recalibrate": (await import("./api/cron/recalibrate.ts")).default,
};

const PORT = 3001;

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
    _headers: { "Access-Control-Allow-Origin": "*" },
    status(code) {
      this._status = code;
      return this;
    },
    // Handlers that set their own CORS headers (e.g. api/feedback.ts, which
    // needs to allow the Authorization header on top of the wildcard origin
    // every response already gets below) call this before status()/json() -
    // mirrors the subset of the real VercelResponse/http.ServerResponse API
    // those handlers actually use.
    setHeader(name, value) {
      this._headers[name] = value;
      return this;
    },
    json(body) {
      nodeRes.writeHead(this._status, {
        "Content-Type": "application/json",
        ...this._headers,
      });
      nodeRes.end(JSON.stringify(body));
    },
    end(body) {
      nodeRes.writeHead(this._status, this._headers);
      nodeRes.end(body);
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const query = Object.fromEntries(url.searchParams);
  try {
    const body = await readJsonBody(req);
    await handler({ query, body, method: req.method, headers: req.headers }, makeRes(res));
  } catch (err) {
    res.writeHead(500, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`Dev API server on http://localhost:${PORT}`);
  console.log("Routes:", Object.keys(routes).join(", "));
});
