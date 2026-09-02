import { describe, expect, it } from "vitest";
import { parseLatLon } from "./validate";

describe("parseLatLon", () => {
  it("accepts valid coordinates as query strings (how Vercel actually hands them in)", () => {
    expect(parseLatLon({ lat: "50.075", lon: "14.44" })).toEqual({ lat: 50.075, lon: 14.44 });
  });

  it("accepts the exact boundary values", () => {
    expect(parseLatLon({ lat: "90", lon: "180" })).toEqual({ lat: 90, lon: 180 });
    expect(parseLatLon({ lat: "-90", lon: "-180" })).toEqual({ lat: -90, lon: -180 });
  });

  it("rejects out-of-range latitude/longitude", () => {
    expect(parseLatLon({ lat: "91", lon: "14" })).toBeNull();
    expect(parseLatLon({ lat: "50", lon: "181" })).toBeNull();
    expect(parseLatLon({ lat: "-91", lon: "14" })).toBeNull();
    expect(parseLatLon({ lat: "50", lon: "-181" })).toBeNull();
  });

  it("rejects Infinity and NaN-producing input", () => {
    expect(parseLatLon({ lat: "Infinity", lon: "14" })).toBeNull();
    expect(parseLatLon({ lat: "not-a-number", lon: "14" })).toBeNull();
  });

  it("rejects missing/undefined fields", () => {
    expect(parseLatLon({})).toBeNull();
    expect(parseLatLon({ lat: "50" })).toBeNull();
  });

  it("rejects null and array values (how a malformed/duplicated query param arrives)", () => {
    expect(parseLatLon({ lat: null, lon: "14" })).toBeNull();
    expect(parseLatLon({ lat: ["50", "51"], lon: "14" })).toBeNull();
  });
});
