// Daily "kde dnes rostou houby" report - today's 3 best spots nationwide,
// with real per-species percentages and a direct link to each one's live
// map view, e-mailed to the app owner every morning. Triggered from
// api/cron/watchdog.ts (piggybacked onto its existing 06:00 UTC schedule -
// Vercel Hobby caps cron jobs at 2/project and this project's other slot
// is already api/cron/recalibrate.ts) and also reachable directly via
// api/send-report-email.ts for manual testing without touching watchdog's
// real user-facing alert logic.
//
// Two earlier versions of this existed, both abandoned 2026-09-13:
//   1. A scheduled Claude cloud agent - that sandbox's egress policy
//      hard-blocks hriboradar.app entirely, with no user-facing way to
//      allow it.
//   2. Server-side screenshots via puppeteer-core + @sparticuz/chromium,
//      run inside this same Vercel function. Got real screenshots working
//      end to end, but the target page (mapa.html -> /api/map) does a
//      genuinely heavy client-side pass over ~36k forest polygons to mask
//      the probability cloud (see leafletHtml.ts's own comment on it),
//      and that unpredictably hung the whole render on a constrained
//      Hobby-plan shared vCPU - even with a hard per-spot timeout, since
//      the underlying Chromium process itself could become unresponsive
//      to new commands, not just slow to respond to the one already
//      waiting. Chased it through 5 rounds of fixes (ESM import rewriting,
//      missing transitive deps, an ETXTBSY race, a wrong zoom param) before
//      concluding a real fix needs infra this project doesn't have
//      (a dedicated screenshot service, or more CPU than Hobby gives a
//      single function) - not worth it for 3 images/day. The user's own
//      call: send the link, let them screenshot it themselves.
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
  mapUrl: string;
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

const FOREST_TYPE_TEXT: Record<NonNullable<TerrainInfo["dominantType"]>, string> = {
  jehličnatý: "jehličnatý les",
  listnatý: "listnatý les",
  smíšený: "smíšený les",
};

// Joins Czech names with "a" before the last one ("A, B a C") instead of a
// bare comma list - reads like something a person wrote, not a CSV dump.
function joinCz(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} a ${items[items.length - 1]}`;
}

// A short, warm paragraph explaining WHY, not just a fact-dump of numbers -
// on request 2026-09-13 ("ty zprávy by se mi hodily opravdu jako líp
// vysvětlený proč a co roste"). Leads with the species and percentages
// (the actual news), then weaves weather and forest type together as the
// reasoning, in one flowing sentence rather than a labeled "Počasí: ..."
// line - the house style throughout this app's copy (see lib/email.ts,
// public/mapa.html) is direct and conversational, not a spec sheet.
function describeSpot(spot: ReportSpot): string {
  const named = spot.species.map((s) => `${s.name_cz} (${s.probability_pct} %)`);
  const weak = spot.species.every((s) => s.probability_pct < MIN_REPORT_PCT);
  const lead = weak
    ? `Dnes to tu nikde moc nehoří, ale nejblíž k tomu má ${joinCz(named)} - je to nejlepší nabídka z celého dnešního dne.`
    : `Dnes tu má nejlepší šanci ${joinCz(named)}.`;

  const c = spot.conditions;
  if (!c) return lead;

  const rainText =
    c.daysSinceRain === 0
      ? "dnes vydatně pršelo"
      : c.daysSinceRain === 1
        ? "naposledy vydatně pršelo včera"
        : `naposledy vydatně pršelo před ${c.daysSinceRain} dny`;
  const moistureText =
    c.soilMoisturePct >= 35
      ? `půda je pořád pěkně vlhká (${Math.round(c.soilMoisturePct)} %)`
      : c.soilMoisturePct >= 20
        ? `půda má ještě slušnou vlhkost (${Math.round(c.soilMoisturePct)} %)`
        : `půda už je dost suchá (jen ${Math.round(c.soilMoisturePct)} % vlhkosti)`;

  const forestType = c.terrain.dominantType ? FOREST_TYPE_TEXT[c.terrain.dominantType] : null;
  const genera = c.terrain.treeGenera.slice(0, 3).join(", ");
  const forestText = forestType
    ? genera
      ? `V okolí navíc roste hlavně ${forestType} (${genera}), přesně to, co tyhle druhy potřebují`
      : `V okolí navíc roste hlavně ${forestType}`
    : null;

  const why = `${rainText.charAt(0).toUpperCase() + rainText.slice(1)}, teploty se drží kolem ${c.tempC} °C a ${moistureText}.${forestText ? ` ${forestText}.` : ""}`;

  return `${lead} ${why}`;
}

function composeHtml(spots: ReportSpot[], today: string): string {
  const rows = spots
    .map((spot, i) => {
      return `
        <div style="margin-bottom:24px;padding-bottom:20px;${i < spots.length - 1 ? "border-bottom:1px solid #E4DCC6" : ""}">
          <h2 style="font-size:17px;margin:0 0 8px">${spot.name}</h2>
          <p style="margin:0;color:#5A5847">${describeSpot(spot)}</p>
          <p style="margin:10px 0 0">
            <a href="${spot.mapUrl}" style="color:#33482C;font-weight:600">Otevřít mapu tohoto místa →</a>
          </p>
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
  spots?: { name: string; mapUrl: string; species: SpotSpecies[] }[];
}> {
  try {
    const grid = await computeGrid();
    const topSpots = pickTopSpots(grid.points);

    const scored = await Promise.all(
      topSpots.map(async (spot) => ({ spot, ...(await scoreSpotSpecies(spot.lat, spot.lon)) }))
    );

    const reportSpots: ReportSpot[] = scored.map(({ spot, species, conditions }) => {
      const bestSpeciesId = species[0]?.id ?? grid.speciesList[0]?.id ?? "";
      // mapa.html (public/mapa.html - a standalone page, not part of the
      // mobile app) forwards its own querystring verbatim to /api/map,
      // which specifically reads "fzoom" for the initial zoomed-in view
      // (lat/lon alone only place the marker) - plain "zoom" is silently
      // ignored (found 2026-09-13, a screenshot came out at the whole-
      // country default view instead of zoomed into the spot).
      const mapUrl = `https://hriboradar.app/mapa.html?species=${encodeURIComponent(bestSpeciesId)}&lat=${spot.lat}&lon=${spot.lon}&fzoom=${MAP_ZOOM}`;
      return { ...spot, species, conditions, mapUrl };
    });

    const today = new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
    const html = composeHtml(reportSpots, today);

    // skipEmail: used only by api/send-report-email.ts's manual debug path
    // to check the picked spots/links without spending a real Resend send.
    if (opts?.skipEmail) {
      return {
        ok: true,
        spots: reportSpots.map((s) => ({ name: s.name, mapUrl: s.mapUrl, species: s.species })),
      };
    }

    const result = await sendEmail({
      to: REPORT_TO,
      subject: `🍄 Dnešní houbové tipy - ${today}`,
      html,
    });

    if (!result.ok) {
      captureError(new Error("runDailyReport send failed"), { resendError: result.error });
      return { ok: false, error: result.error };
    }
    return {
      ok: true,
      spots: reportSpots.map((s) => ({ name: s.name, mapUrl: s.mapUrl, species: s.species })),
    };
  } catch (err) {
    captureError(err, { step: "runDailyReport" });
    return { ok: false, error: String(err) };
  }
}
