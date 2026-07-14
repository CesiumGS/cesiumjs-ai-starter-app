import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultGlobeSetLightingInputSchema } from "./globeSetLighting.js";
import { globeSetLightingInputShape } from "./globeSetLighting.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, types) on one
 * side without the other — e.g. by hardcoding constraints inside
 * `buildGlobeSetLightingInputSchema` instead of deriving them from the shared
 * `globeSetLightingInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "baseline valid", input: { enableLighting: true }, valid: true },
  {
    name: "with dynamic atmosphere",
    input: { enableLighting: true, enableDynamicAtmosphere: false },
    valid: true,
  },
  {
    name: "with sun lighting",
    input: { enableLighting: true, enableSunLighting: false },
    valid: true,
  },
  { name: "all fields included", input: { enableLighting: false, enableDynamicAtmosphere: true, enableSunLighting: true }, valid: true }, // prettier-ignore
  { name: "dynamic atmosphere omitted", input: { enableLighting: true }, valid: true },
  { name: "sun lighting omitted", input: { enableLighting: true }, valid: true },
  { name: "missing enableLighting", input: { enableDynamicAtmosphere: true }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong type", input: { enableLighting: "true" }, valid: false },
];

describe("globeSetLighting schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultGlobeSetLightingInputSchema.safeParse(input).success;
      const frontend = globeSetLightingInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
