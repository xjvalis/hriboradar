// Minimal Resend wrapper - plain fetch against their REST API rather than
// pulling in their SDK for what's currently three transactional emails
// (subscribe/cancel/billing-issue, see api/webhooks/revenuecat.ts). Silent
// no-op with a console.error when RESEND_API_KEY isn't set (e.g. local
// dev) rather than throwing - a failed/missing email should never be the
// reason a webhook request fails and gets retried by RevenueCat.
// Sender address still lives on the old rostou.app domain - Resend only
// sends from a domain that's been verified there via DNS records, and
// hriboradar.app hasn't been added/verified yet. Swap once that's done;
// until then the display name alone carries the new brand.
const RESEND_FROM = "Hřiboradar <noreply@rostou.app>";
const FETCH_TIMEOUT_MS = 8000;

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not set, skipping send:", opts.subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: opts.to, subject: opts.subject, html: opts.html }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) console.error("[email] Resend returned", res.status, await res.text());
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

const WRAPPER_START = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;line-height:1.6;color:#24261D;background:#EDE6D6">
`;
const WRAPPER_END = `
  <p style="color:#8C8A6E;font-size:12px;margin-top:32px">Hřiboradar · <a href="https://hriboradar.app/privacy.html" style="color:#8C8A6E">Zásady ochrany osobních údajů</a></p>
</div>
`;

export function subscriptionActiveEmail(): { subject: string; html: string } {
  return {
    subject: "Vítejte v Hřiboradar Plus 🍄",
    html: `${WRAPPER_START}
      <h1 style="font-size:20px">Hřiboradar Plus je aktivní</h1>
      <p>Díky za podporu! Teď máte navíc: neomezená uložená místa, předpověď na 7 dní dopředu, rozpad podle konkrétní houby a chytrá upozornění na sezónu.</p>
      <p>Předplatné spravujete přímo ve svém App Store / Google Play účtu - zrušit ho jde kdykoli tam.</p>
    ${WRAPPER_END}`,
  };
}

export function subscriptionCanceledEmail(periodEnd: string | null): { subject: string; html: string } {
  const untilText = periodEnd
    ? `zůstane aktivní do ${new Date(periodEnd).toLocaleDateString("cs-CZ")}`
    : "zůstane aktivní do konce zaplaceného období";
  return {
    subject: "Předplatné Hřiboradar Plus bylo zrušeno",
    html: `${WRAPPER_START}
      <h1 style="font-size:20px">Mrzí nás, že odcházíte</h1>
      <p>Vaše Hřiboradar Plus ${untilText}, pak se appka vrátí na bezplatnou verzi. Kdykoli se dá znovu zapnout v appce.</p>
    ${WRAPPER_END}`,
  };
}

export function billingIssueEmail(): { subject: string; html: string } {
  return {
    subject: "Problém s platbou za Hřiboradar Plus",
    html: `${WRAPPER_START}
      <h1 style="font-size:20px">Platba se nezdařila</h1>
      <p>Nepodařilo se nám obnovit vaše předplatné Hřiboradar Plus - zkontrolujte prosím platební metodu v App Store / Google Play, ať o Plus funkce nepřijdete.</p>
    ${WRAPPER_END}`,
  };
}

// Houbařský pes - api/cron/watchdog.ts sends this once a saved location's
// watchdog crosses its threshold. speciesName is null for a "kterýkoli
// druh" watchdog, where topSpeciesName carries whichever species actually
// drove the score up (see overallScore() in lib/grid.ts).
export function watchdogEmail(opts: {
  locationLabel: string;
  speciesName: string | null;
  topSpeciesName: string | null;
  score: number;
  thresholdPct: number;
}): { subject: string; html: string } {
  const { locationLabel, speciesName, topSpeciesName, score, thresholdPct } = opts;
  const subject = speciesName
    ? `🐕 ${speciesName} na "${locationLabel}" má teď ${score} %`
    : `🐕 "${locationLabel}" má teď ${score} % šanci na houby`;
  const bodyLine = speciesName
    ? `<strong>${speciesName}</strong> má teď na místě „${locationLabel}“ odhadovanou šanci <strong>${score} %</strong> - to je nad vaší hranicí ${thresholdPct} %.`
    : `Místo „${locationLabel}“ má teď odhadovanou šanci na houby <strong>${score} %</strong>${
        topSpeciesName ? ` (nejlépe na tom je <strong>${topSpeciesName}</strong>)` : ""
      } - to je nad vaší hranicí ${thresholdPct} %.`;
  return {
    subject,
    html: `${WRAPPER_START}
      <h1 style="font-size:20px">🐕 Houbařský pes hlásí</h1>
      <p>${bodyLine}</p>
      <p>Otevřete appku a mrkněte na detail, jestli se vyplatí vyrazit.</p>
      <p style="color:#8C8A6E;font-size:13px">Tohle hlídání se ozve zase, až šance nejdřív klesne pod hranici a pak ji znovu překročí - ne znovu zítra, pokud zůstane stejně vysoká.</p>
    ${WRAPPER_END}`,
  };
}
