// Daily "kde dnes rostou houby" report - three real screenshots of the
// public mapa.html preview (see public/mapa.html) at today's best spots,
// plus real per-species percentages, e-mailed to the app owner every
// morning. Triggered from api/cron/watchdog.ts (piggybacked onto its
// existing 06:00 UTC schedule - Vercel Hobby caps cron jobs at 2/project
// and this project's other slot is already api/cron/recalibrate.ts) and
// also reachable directly via api/send-report-email.ts for manual testing
// without touching watchdog's real user-facing alert logic.
//
// An earlier version of this ran as a scheduled Claude cloud agent
// instead - abandoned 2026-09-13 when that sandbox's egress policy
// turned out to hard-block hriboradar.app entirely, with no user-facing
// way to allow it. Running inside this project's own Vercel deployment
// sidesteps that: this code already has full outbound internet access
// (it's the same infra api/forecast.ts etc. run on) and the real
// RESEND_API_KEY, no secret-passing needed.
import { computeGrid } from "./grid";
import { fetchWeather } from "./weather";
import { fetchTerrain, type TerrainInfo } from "./terrain";
import { scoreSpeciesDay, type Species } from "./scoring";
import { applyCalibratedProbability } from "./calibration";
import { sendEmail } from "./email";
import { captureError } from "./sentry";
import { SCENIC_AREAS, type ScenicArea } from "./scenicAreas";
import speciesData from "../api/data/species.json";

const REPORT_TO = "xjvalis@gmail.com";
const SPOT_COUNT = 3;
// ~0.55 degrees of latitude - keeps the 3 picked spots from all landing in
// the same mountain range on a day where one region's weather just happens
// to dominate the ranking.
const MIN_SEPARATION_DEG = 0.55;
const MIN_REPORT_PCT = 20;
const MAP_ZOOM = 10;
const SCREENSHOT_VIEWPORT = { width: 1000, height: 1300 };

interface Spot extends ScenicArea {
  overall: number;
}

interface SpotSpecies {
  id: string;
  name_cz: string;
  probability_pct: number;
}

interface SpotConditions {
  tempC: number;
  rain3dMm: number;
  daysSinceRain: number;
  soilMoisturePct: number;
  terrain: TerrainInfo;
}

interface ReportSpot extends Spot {
  species: SpotSpecies[];
  conditions: SpotConditions | null;
  screenshotPng: Buffer | null;
  screenshotError: string | null;
}

function pickTopSpots(gridPoints: { lat: number; lon: number; overall: number }[]): Spot[] {
  const scored: Spot[] = SCENIC_AREAS.map((area) => {
    let nearest = gridPoints[0];
    let bestDist = Infinity;
    for (const p of gridPoints) {
      const d = (p.lat - area.lat) ** 2 + (p.lon - area.lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        nearest = p;
      }
    }
    return { ...area, overall: nearest?.overall ?? 0 };
  }).sort((a, b) => b.overall - a.overall);

  const picked: Spot[] = [];
  for (const area of scored) {
    if (picked.length >= SPOT_COUNT) break;
    const farEnough = picked.every(
      (p) => Math.abs(p.lat - area.lat) >= MIN_SEPARATION_DEG || Math.abs(p.lon - area.lon) >= MIN_SEPARATION_DEG
    );
    if (farEnough) picked.push(area);
  }
  // Spacing couldn't be satisfied (a very localized hotspot dominating the
  // whole ranking) - fill any remaining slots with the next best scorers
  // regardless of distance rather than reporting fewer than SPOT_COUNT.
  for (const area of scored) {
    if (picked.length >= SPOT_COUNT) break;
    if (!picked.includes(area)) picked.push(area);
  }
  return picked;
}

function daysSinceLastRain(days: { date: string; precipMm: number }[], todayIndex: number, thresholdMm = 2): number {
  for (let i = todayIndex; i >= 0; i--) {
    if (days[i].precipMm >= thresholdMm) return todayIndex - i;
  }
  return todayIndex + 1; // no qualifying rain anywhere in the lookback window
}

async function scoreSpotSpecies(lat: number, lon: number): Promise<{ species: SpotSpecies[]; conditions: SpotConditions | null }> {
  const [days, terrain] = await Promise.all([fetchWeather(lat, lon), fetchTerrain(lat, lon)]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayIndex = days.findIndex((d) => d.date === todayStr);
  if (todayIndex === -1) return { species: [], conditions: null };

  const species = speciesData.species as Species[];
  const scored = await Promise.all(
    species.map(async (sp) => {
      const raw = scoreSpeciesDay(days, todayIndex, sp, terrain);
      const probability_pct = await applyCalibratedProbability(raw.probability_pct, sp.id);
      return { id: sp.id, name_cz: sp.name_cz, probability_pct };
    })
  );
  scored.sort((a, b) => b.probability_pct - a.probability_pct);
  const qualifying = scored.filter((s) => s.probability_pct >= MIN_REPORT_PCT).slice(0, 4);

  const rain3dMm = Math.round(
    days.slice(Math.max(0, todayIndex - 2), todayIndex + 1).reduce((sum, d) => sum + d.precipMm, 0)
  );
  const conditions: SpotConditions = {
    tempC: Math.round(days[todayIndex].tempAvgC * 10) / 10,
    rain3dMm,
    daysSinceRain: daysSinceLastRain(days, todayIndex),
    soilMoisturePct: days[todayIndex].soilMoisturePct,
    terrain,
  };

  return { species: qualifying.length > 0 ? qualifying : scored.slice(0, 1), conditions };
}

// @sparticuz/chromium is ESM-only ("type": "module", no CJS export) - this
// whole project compiles to CommonJS (tsconfig's module: commonjs, and
// Vercel's own esbuild bundling follows suit), and both TS and esbuild
// rewrite a plain `await import("literal-string")` into a `require()` call
// when they can statically resolve the target, which then crashes at
// runtime with ERR_REQUIRE_ESM (confirmed 2026-09-13 in production).
// `eval("import(...)")` hides the import specifier from that static
// rewrite, forcing Node's own dynamic import - which, unlike require(),
// can load a real ESM package from CommonJS.
async function loadChromiumLauncher(): Promise<{ args: string[]; executablePath: string; puppeteer: typeof import("puppeteer-core") }> {
  const chromium = (await eval('import("@sparticuz/chromium")')).default;
  const puppeteer = await eval('import("puppeteer-core")');
  // Resolved once and reused across all 3 parallel screenshots (see
  // Promise.all below) - chromium.executablePath() extracts the bundled
  // binary to a shared temp path on first call, and two concurrent
  // extractions of the same file raced into ETXTBSY ("text file busy",
  // one process tried to exec it while another was still writing it)
  // the first time this ran with 3 fully independent per-spot calls.
  const executablePath = await chromium.executablePath();
  return { args: chromium.args, executablePath, puppeteer };
}

async function screenshotSpot(
  spot: Spot,
  bestSpeciesId: string,
  launcher: { args: string[]; executablePath: string; puppeteer: typeof import("puppeteer-core") }
): Promise<{ png: Buffer | null; error: string | null }> {
  const url = `https://hriboradar.app/mapa.html?species=${encodeURIComponent(bestSpeciesId)}&lat=${spot.lat}&lon=${spot.lon}&zoom=${MAP_ZOOM}`;
  try {
    const browser = await launcher.puppeteer.launch({
      args: launcher.args,
      executablePath: launcher.executablePath,
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.setViewport(SCREENSHOT_VIEWPORT);
      await page.goto(url, { waitUntil: "load", timeout: 15000 });
      // mapa.html's own <script> sets #mapFrame's src (a same-origin
      // /api/map iframe) after the outer page loads - "networkidle0" on
      // the OUTER page's own goto doesn't track that inner frame's fetches
      // (grid data + Leaflet tiles), so a fixed pause here was screenshotting
      // a blank map most of the time (found 2026-09-13 from a real report
      // email showing an empty map area). Poll for real rendered tiles
      // inside that iframe instead - same-origin, so contentDocument is
      // reachable from here.
      await page
        .waitForFunction(
          () => {
            const frame = document.getElementById("mapFrame") as HTMLIFrameElement | null;
            const tiles = frame?.contentDocument?.querySelectorAll(".leaflet-tile-loaded");
            return !!tiles && tiles.length >= 4;
          },
          { timeout: 12000 }
        )
        .catch(() => {}); // fall through and screenshot whatever rendered rather than erroring the whole spot
      // Small settle time for the probability-cloud overlay, which paints
      // just after the base tiles (postMessage-driven, not itself part of
      // the tile-load signal above).
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const png = await page.screenshot({ type: "png" });
      return { png: Buffer.from(png), error: null };
    } finally {
      await browser.close();
    }
  } catch (err) {
    captureError(err, { step: "screenshotSpot", url });
    return { png: null, error: String(err) };
  }
}

const FOREST_TYPE_TEXT: Record<NonNullable<TerrainInfo["dominantType"]>, string> = {
  jehličnatý: "jehličnatý les",
  listnatý: "listnatý les",
  smíšený: "smíšený les",
};

function describeConditions(c: SpotConditions): string {
  const parts: string[] = [];
  parts.push(`${c.tempC} °C`);
  parts.push(
    c.daysSinceRain === 0
      ? "dnes pršelo"
      : c.daysSinceRain === 1
        ? "naposledy pršelo včera"
        : `naposledy pršelo před ${c.daysSinceRain} dny`
  );
  if (c.rain3dMm > 0) parts.push(`za poslední 3 dny spadlo ${c.rain3dMm} mm`);
  parts.push(`vlhkost půdy ${Math.round(c.soilMoisturePct)} %`);

  const forestType = c.terrain.dominantType ? FOREST_TYPE_TEXT[c.terrain.dominantType] : null;
  const genera = c.terrain.treeGenera.slice(0, 3).join(", ");
  const forestText = forestType
    ? genera
      ? `V okolí převažuje ${forestType} (${genera})`
      : `V okolí převažuje ${forestType}`
    : null;

  return `Počasí: ${parts.join(", ")}.${forestText ? ` ${forestText}.` : ""}`;
}

function composeHtml(spots: ReportSpot[], today: string): string {
  const rows = spots
    .map((spot, i) => {
      const speciesText = spot.species.map((s) => `${s.name_cz} ${s.probability_pct} %`).join(", ");
      const weak = spot.species.every((s) => s.probability_pct < MIN_REPORT_PCT);
      const note = weak ? " (dnes tam nic moc neroste, ale je to pořád nejlepší z dnešní nabídky)" : "";
      const conditionsText = spot.conditions ? describeConditions(spot.conditions) : "";
      const screenshotNote = spot.screenshotPng
        ? `Screenshot v příloze: spot${i + 1}.png`
        : "Screenshot se dnes bohužel nepodařilo vygenerovat.";
      return `
        <div style="margin-bottom:24px;padding-bottom:20px;${i < spots.length - 1 ? "border-bottom:1px solid #E4DCC6" : ""}">
          <h2 style="font-size:17px;margin:0 0 6px">${spot.name}</h2>
          <p style="margin:0;color:#5A5847">${speciesText}${note}</p>
          ${conditionsText ? `<p style="margin:8px 0 0;font-size:13px;color:#5A5847">${conditionsText}</p>` : ""}
          <p style="margin:6px 0 0;font-size:12px;color:#8C8A6E">${screenshotNote}</p>
        </div>`;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;line-height:1.6;color:#24261D;background:#EDE6D6">
      <h1 style="font-size:20px">Dnešní houbové tipy - ${today}</h1>
      ${rows}
      <p style="color:#8C8A6E;font-size:12px;margin-top:32px">Hřiboradar · denní report</p>
    </div>`;
}

export async function runDailyReport(opts?: { skipEmail?: boolean }): Promise<{
  ok: boolean;
  error?: string;
  spots?: { name: string; screenshot: boolean; screenshotError?: string | null; screenshotPngBase64?: string }[];
}> {
  try {
    const grid = await computeGrid();
    const topSpots = pickTopSpots(grid.points);
    const launcher = await loadChromiumLauncher();

    // Scoring (weather/terrain HTTP fetches, no Chromium) stays parallel -
    // that's cheap I/O, not CPU. Screenshots run one at a time instead:
    // 3 concurrent Chromium instances on a single Hobby function's shared
    // vCPU contended hard enough for CPU time that tile-loading (see
    // screenshotSpot's own comment) blew past even a 20s-per-spot budget
    // and the whole function hit Vercel's 60s maxDuration wall (504,
    // confirmed 2026-09-13). Sequential is slower in isolation but far
    // more predictable - each spot gets the CPU to itself. The launcher
    // (resolved once, above) is still shared across all 3.
    const scored = await Promise.all(
      topSpots.map(async (spot) => ({ spot, ...(await scoreSpotSpecies(spot.lat, spot.lon)) }))
    );

    const reportSpots: ReportSpot[] = [];
    for (const { spot, species, conditions } of scored) {
      const bestSpeciesId = species[0]?.id ?? grid.speciesList[0]?.id ?? "";
      const { png: screenshotPng, error: screenshotError } = bestSpeciesId
        ? await screenshotSpot(spot, bestSpeciesId, launcher)
        : { png: null, error: "no species id" };
      reportSpots.push({ ...spot, species, conditions, screenshotPng, screenshotError });
    }

    const today = new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
    const html = composeHtml(reportSpots, today);
    const attachments = reportSpots
      .map((spot, i) =>
        spot.screenshotPng ? { filename: `spot${i + 1}.png`, content: spot.screenshotPng.toString("base64") } : null
      )
      .filter((a): a is { filename: string; content: string } => a !== null);

    // skipEmail: used only by api/send-report-email.ts's manual debug path
    // to inspect a screenshot directly (as base64) without spending a real
    // Resend send on every iteration while tuning the screenshot timing.
    if (opts?.skipEmail) {
      return {
        ok: true,
        spots: reportSpots.map((s) => ({
          name: s.name,
          screenshot: !!s.screenshotPng,
          screenshotError: s.screenshotError,
          screenshotPngBase64: s.screenshotPng?.toString("base64"),
        })),
      };
    }

    const result = await sendEmail({
      to: REPORT_TO,
      subject: `🍄 Dnešní houbové tipy - ${today}`,
      html,
      attachments,
    });

    if (!result.ok) {
      captureError(new Error("runDailyReport send failed"), { resendError: result.error });
      return { ok: false, error: result.error };
    }
    return {
      ok: true,
      spots: reportSpots.map((s) => ({ name: s.name, screenshot: !!s.screenshotPng, screenshotError: s.screenshotError })),
    };
  } catch (err) {
    captureError(err, { step: "runDailyReport" });
    return { ok: false, error: String(err) };
  }
}
