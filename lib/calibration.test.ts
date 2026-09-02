import { describe, expect, it } from "vitest";
import { applyCalibratedProbability } from "./calibration";

// No SUPABASE_URL/SUPABASE_ANON_KEY in the test environment - the function
// falls back to "no calibration data available" (an empty stats map) in
// that case, same as a fresh install with no feedback yet. That's exactly
// the safe path this test exercises: these assertions don't depend on any
// network mocking because they never get past that fallback.
describe("applyCalibratedProbability", () => {
  it("returns 0 for non-finite input instead of propagating NaN/Infinity", async () => {
    expect(await applyCalibratedProbability(NaN, "hrib-smrkovy")).toBe(0);
    expect(await applyCalibratedProbability(Infinity, "hrib-smrkovy")).toBe(0);
    expect(await applyCalibratedProbability(-Infinity, "hrib-smrkovy")).toBe(0);
  });

  it("returns the raw value unchanged when no calibration data is available", async () => {
    expect(await applyCalibratedProbability(42, "hrib-smrkovy")).toBe(42);
    expect(await applyCalibratedProbability(0, "hrib-smrkovy")).toBe(0);
    expect(await applyCalibratedProbability(100, "hrib-smrkovy")).toBe(100);
  });
});
