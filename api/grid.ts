import type { VercelRequest, VercelResponse } from "@vercel/node";
import { computeGrid } from "../lib/grid";
import { withSentry } from "../lib/sentry";

/**
 * GET /api/grid
 *
 * Today's probability for every species, across a grid of points clipped
 * to the real Czech Republic border (not a rectangle - the first version
 * painted circles into Germany/Austria/Poland/Slovakia, which was wrong).
 *
 * Returns both a per-point "overall" score and full per-species scores, so
 * the client can switch between "všechny houby" and any single species
 * without a refetch - the expensive part is the two external fetches per
 * point, which happen once regardless of how many species we score from
 * them. Also used server-side by /api/map (same grid, rendered as an HTML
 * page instead of JSON) - see lib/grid.ts.
 */
async function handler(_req: VercelRequest, res: VercelResponse) {
  const data = await computeGrid();
  res.status(200).json(data);
}

export default withSentry(handler);
