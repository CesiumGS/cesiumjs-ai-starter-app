import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultFlyToInputSchema } from "./flyTo.js";
import { flyToInputShape } from "./flyTo.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (lat/lon ranges, required fields, types) on one
 * side without the other — e.g. by hardcoding constraints inside
 * `buildFlyToInputSchema` instead of deriving them from the shared
 * `flyToInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "origin", input: { latitude: 0, longitude: 0 }, valid: true },
  { name: "with altitude", input: { latitude: 48.8566, longitude: 2.3522, altitude: 15000 }, valid: true }, // prettier-ignore
  { name: "lat upper bound 90", input: { latitude: 90, longitude: 0 }, valid: true },
  { name: "lat lower bound -90", input: { latitude: -90, longitude: 0 }, valid: true },
  { name: "lon upper bound 180", input: { latitude: 0, longitude: 180 }, valid: true },
  { name: "lon lower bound -180", input: { latitude: 0, longitude: -180 }, valid: true },
  { name: "lat above range", input: { latitude: 90.0001, longitude: 0 }, valid: false },
  { name: "lat below range", input: { latitude: -90.0001, longitude: 0 }, valid: false },
  { name: "lon above range", input: { latitude: 0, longitude: 180.0001 }, valid: false },
  { name: "lon below range", input: { latitude: 0, longitude: -999 }, valid: false },
  { name: "missing longitude", input: { latitude: 10 }, valid: false },
  { name: "missing latitude", input: { longitude: 10 }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong type", input: { latitude: "10", longitude: 20 }, valid: false },
  { name: "zero altitude (non-positive)", input: { latitude: 0, longitude: 0, altitude: 0 }, valid: false }, // prettier-ignore
  { name: "negative altitude", input: { latitude: 0, longitude: 0, altitude: -5 }, valid: false },
];

describe("flyTo schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultFlyToInputSchema.safeParse(input).success;
      const frontend = flyToInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
