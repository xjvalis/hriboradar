# Code Quality Report — Hřiboradar

Human-engineering review: not a security audit, not a "could this be written
differently" survey. The question for every finding is *"would a good human
engineer intentionally write this?"* — flags only things that look
accidental, duplicated, over-engineered, or drifted from the codebase's own
stated conventions.

Scope note: this is a targeted pass (grep for known smell classes + reading
the flagged spots), not a line-by-line read of all ~15,000 lines. It's biased
toward the highest-value findings, not exhaustive coverage.

Overall impression up front: this codebase is unusually disciplined for its
size — one design-token file (`theme.ts`), one consistent Context+Provider
shape per domain, no `any`, no `@ts-ignore`, no stray `eslint-disable`. The
findings below are real but small in number; there is no rot to clean up.

---

## Findings

### 1. `lib/leafletHtml.ts` and `mobile/src/leafletHtml.ts` are out of sync — **REFACTOR** (fixed below)

Two ~1,100-line files contain the same Leaflet map HTML/JS, duplicated on
purpose (documented at the top of `lib/leafletHtml.ts`: Expo can't import
from outside `mobile/`, so the server needs its own copy to render
`/api/map` for native WebView clients, while the web build generates the
same HTML client-side into an iframe). The file's own comment says "keep
both copies in sync by hand" — and they currently aren't: a same-day fix
(the "Vaše poloha" marker z-order bug + the new `setUserLocation` message
handler for the "recenter to my location" button) landed only in
`mobile/src/leafletHtml.ts`. Native iOS/Android users — the actual App
Store audience — are running the broken version right now.

This is exactly the failure mode a "keep two files in sync by hand" comment
predicts. Not a design mistake (Expo's import boundary is real, and there's
no bundler-neutral way around it without pulling `lib/` into `mobile/` as a
package), but a process gap: nothing catches drift between the two files.

**Fix applied**: ported the marker-pane fix and `setUserLocation` handler
into `lib/leafletHtml.ts` to match. **Not fixed** (would need a bigger
decision, out of scope for a "safe improvement"): a build-time check (a
small script comparing the two files' hashes, run in CI) that fails loudly
the next time they drift, instead of silently shipping a native/web
behavior gap again.

### 2. Debug `console.log` left in shipped map-init JS — **REMOVE** (fixed below)

`mobile/src/leafletHtml.ts` (init script, both copies) has:

```js
console.log('[Map Init] Container size:', mapEl.clientWidth, 'x', mapEl.clientHeight);
...
[10, 50, 100, 200, 400, 800, 1200].forEach(function (ms) {
  setTimeout(function () {
    console.log('[Map Init] invalidateSize at', ms, 'ms');
    ...
```

This runs in every real user's WebView/browser on every map load. Harmless
at runtime (nobody's watching a phone's WebView console), but it's
debug-session residue, not intentional logging — the surrounding comment
voice ("CRITICAL:", "Aggressive invalidation... runs many times to catch
size changes") also reads like a hurried patch-note rather than this file's
usual why-focused prose. The underlying retry-loop *workaround* is a
legitimate fix for a real native-WebView timing bug (container measures
0×0 at script-execution time) — that part is **KEEP**, just the logging.

**Fix applied**: removed both `console.log` calls (both file copies).

### 3. Two more hand-synced file pairs — **KEEP** (currently fine, same fragility as #1)

- `api/data/species.json` / `mobile/src/data/species.json` — currently
  byte-identical (checked). Same "Expo can't import outside `mobile/`"
  constraint as the leafletHtml pair, same manual-sync risk. Not touched —
  they're in sync today, and a species-data change is far rarer than a map
  UI tweak, so the actual drift risk is much lower than case #1 was.
- `mobile/src/leafletHtml.ts` / `lib/leafletHtml.ts` again, structurally —
  already covered above.

Worth a CI check eventually (diff the two species.json files, diff the two
leafletHtml files, fail the build on mismatch) rather than trusting memory
next time. Not done here — adding CI steps for files that are in sync today
isn't a "safe improvement," it's a process decision worth raising
separately.

### 4. `eslint-disable-next-line react-hooks/exhaustive-deps` × 12 — **KEEP**

Twelve files intentionally suppress the exhaustive-deps warning on a
`useEffect`. Spot-checked several earlier this session (`LocationContext`'s
GPS-on-mount effect, `MapScreen`'s pending-focus-request effect,
`MojeScreen`'s index-loader) — every one is a genuine "run once on mount /
run only when this specific thing changes, not the closure's other deps"
case, each with its own comment explaining why. This is the correct,
narrow use of the escape hatch (one line, one effect, documented) rather
than a blanket suppression — not a smell.

### 5. Deprecated `shadow*` RN-Web style props — **KEEP** (single point of change, not urgent)

`theme.ts`'s `shadow.sheet`/`shadow.card` tokens use `shadowColor` /
`shadowOpacity` / `shadowRadius` / `shadowOffset`, which React Native Web
now warns are deprecated in favor of `boxShadow` (seen in the dev console:
`"shadow*" style props are deprecated. Use "boxShadow"`). This is the
*only* place in the app these props are set — every component consumes it
via `...shadow.card` — so unlike the other findings, this isn't
duplication or drift, it's one token object that will eventually want a
platform-aware `boxShadow` value for web. Cosmetic-severity, single-file
fix whenever someone's touching `theme.ts` next; not worth a dedicated
change right now.

### 6. Everything else checked and found clean

For the record, since the prompt asked to specifically look for these — all
came back negative or explained above, not omitted:

- **`any`-casts / type assertions hiding problems**: none. `grep -rn ": any\b|as any\b"` across `mobile/src`, `api/`, `lib/` returns zero real hits (one false-positive match on the English word "any" inside a comment).
- **`@ts-ignore` / `@ts-expect-error`**: none anywhere.
- **Suppressed lint rules other than the documented exhaustive-deps cases**: none.
- **Unused dependencies**: checked `expo-clipboard`, `expo-dev-client`, `react-native-svg`, `react-dom` against actual imports — all genuinely used (`react-dom` has no direct import but is a real transitive requirement of `react-native-web`'s web renderer, not dead weight).
- **Hardcoded hex colors outside `theme.ts`**: only in `GoogleSignInButton.tsx` (Google's own brand-mandated colors, explicitly commented as intentional) and `leafletAssets.ts` (map-tile/pin colors, a different rendering context than the app's own screens) — both legitimate, documented exceptions to the "no ad-hoc hex" rule, not violations of it.
- **Giant components/functions**: `leafletHtml.ts` (~1,100 lines) is the only outlier, and it's a template-string HTML/JS generator, not application logic — length there tracks "how big is a Leaflet map page," not "how tangled is this function." Every screen/component file is a reasonable size for what it does.
- **Effect-driven state synchronization / unnecessary state**: `SubscriptionContext.tsx`'s several `useState` calls (`isPremium`, `loading`, `monthly`, `annual`, `activeEntitlement`, `nativeOk`) looked like a candidate at a glance, but each is independent async server state that can't be derived from the others — legitimate, not over-fragmented state.
- **Dead code / stale code**: none found (re-ran the same file-reference heuristic used earlier this session across `lib/`, `api/`, and `mobile/src/` — zero files with no incoming references).
- **TODO/FIXME/XXX markers**: none in the codebase.

---

## Summary

| # | Finding | Class | Action |
|---|---|---|---|
| 1 | `lib/leafletHtml.ts` drifted from `mobile/src/leafletHtml.ts` (native map missing today's location-marker fix) | REFACTOR | **Fixed** — ported the fix |
| 2 | Debug `console.log` in shipped map-init JS (both file copies) | REMOVE | **Fixed** — removed |
| 3 | `species.json` duplicated (currently in sync) | KEEP | No action |
| 4 | 12 documented `exhaustive-deps` suppressions | KEEP | No action |
| 5 | Deprecated `shadow*` props, one token object | KEEP | No action (note left for later) |
| 6 | Any-casts, ts-ignore, unused deps, dead code, TODOs, giant functions | KEEP | None found |

No REMOVE-only or SIMPLIFY-only findings beyond #2. Nothing here rises to
"this looks AI-generated" — the codebase's comment style is verbose by
choice (every comment traces back to a real bug or a real constraint, not
narration of obvious code), which is consistent throughout rather than a
tell of anything accidental.
