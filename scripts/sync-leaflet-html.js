// Copies mobile/src/leafletHtml.ts into lib/leafletHtml.ts with a fixed
// banner prepended. Run this after every edit to mobile/src/leafletHtml.ts
// - see that file's own comment for why the copy exists.
//
// This replaces an ad-hoc one-liner that got re-typed slightly differently
// almost every time it was run this session, and at least once re-derived
// the banner from lib/leafletHtml.ts's own (already slightly-off) first
// lines instead of a fixed constant - each run then baked another stale
// copy of mobile's first content line into the "banner", compounding into
// a visibly corrupted duplicate-on-duplicate header. A real script that
// only reads mobile/src/leafletHtml.ts (never lib/leafletHtml.ts) can't
// drift that way.
const fs = require("fs");
const path = require("path");

const BANNER = [
  "// Duplicated from mobile/src/leafletHtml.ts - same reasoning as species.json's two",
  "// copies (see supabase/rostou_schema.sql history / api/data/species.json): Expo",
  "// cannot import files from outside mobile/, so the server (api/*.ts, and",
  "// dev-server.mjs for local dev) needs its own copy to render /api/map and",
  "// /api/map-pin as real HTML responses. Keep both copies in sync by hand.",
  "",
].join("\n");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "mobile/src/leafletHtml.ts"), "utf8");
fs.writeFileSync(path.join(root, "lib/leafletHtml.ts"), BANNER + "\n" + source);
console.log("synced lib/leafletHtml.ts from mobile/src/leafletHtml.ts");
