// Lightweight local stand-in for `vercel dev` (which needs `vercel login`).
// Serves the same api/*.ts handlers over plain HTTP for local app
// development. Not used in production — Vercel serves api/ directly once
// the repo is connected on vercel.com.
import http from "node:http";
import { URL } from "node:url";

const routes = {
  "/api/predict": (await import("./api/predict.ts")).default,
  "/api/forecast": (await import("./api/forecast.ts")).default,
};

const PORT = 3001;

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
      "Access-Control-Allow-Methods": "GET,OPTIONS",
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
    await handler({ query }, makeRes(res));
  } catch (err) {
    res.writeHead(500, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`Dev API server on http://localhost:${PORT}`);
  console.log("Routes:", Object.keys(routes).join(", "));
});
