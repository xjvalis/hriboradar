/**
 * Tiny in-memory cache for the two slow external lookups (Overpass terrain,
 * Open-Meteo weather). Without this, every screen load re-queries the same
 * fixed points (the 8 "Kam dnes?" regions never move) from scratch, and 9
 * concurrent Overpass requests competing for the same rate-limited public
 * instance is exactly what was making the app take 10-20s to load.
 *
 * Process-lifetime only (resets on server restart) - fine for dev-server.mjs
 * and still helps on Vercel, where warm serverless instances persist memory
 * across requests for a while. A real deployment with real traffic should
 * graduate to Vercel KV or similar, but this removes the actual bottleneck
 * for now without adding infrastructure.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  /**
   * Override the TTL for a specific result - used for "I don't know"
   * fallback results (e.g. an Overpass timeout) so a transient outage
   * doesn't get baked in for the full `ttlMs`, but also doesn't force
   * every single request to pay the full lookup cost while the outage
   * lasts. Return `null`/`undefined` to use `ttlMs`.
   */
  ttlOverrideMs?: (value: T) => number | null | undefined
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  // Also dedupe concurrent in-flight requests for the same key (the 9
  // parallel Home-screen calls include several that share a region point
  // only once, but this also protects against a user bouncing between
  // screens while a fetch for the same spot is still pending).
  const inflightKey = `inflight:${key}`;
  const existing = store.get(inflightKey) as Entry<Promise<T>> | undefined;
  if (existing) return existing.value;

  const promise = fetcher();
  store.set(inflightKey, { value: promise, expiresAt: Date.now() + 15000 });

  try {
    const value = await promise;
    const effectiveTtl = ttlOverrideMs?.(value) ?? ttlMs;
    store.set(key, { value, expiresAt: Date.now() + effectiveTtl });
    return value;
  } catch (err) {
    // Open-Meteo/Overpass having a bad moment (429/503) shouldn't turn into
    // a 500 for every user of an already-known point just because this one
    // instance's cache happened to expire at the wrong second - serving the
    // last good value (however stale) is a much better failure mode than an
    // error banner for data that changes slowly day to day. `hit` is the
    // pre-freshness-check lookup above, so it still holds the expired entry.
    // Only a genuinely first-ever request for this key (nothing to fall
    // back on) still propagates the error - found 2026-09-03, the ~48% of
    // /api/forecast calls that were 500ing during an Open-Meteo outage were
    // almost all for points this cache had served successfully minutes
    // earlier.
    if (hit) {
      console.warn(`[cache] ${key} refresh failed, serving stale value:`, err);
      return hit.value as T;
    }
    throw err;
  } finally {
    store.delete(inflightKey);
  }
}

/** Rounds coordinates so nearby requests (e.g. a slightly jittered GPS fix) share a cache entry. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000; // ~110m precision
}
