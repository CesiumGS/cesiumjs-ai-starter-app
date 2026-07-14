import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultCameraStartOrbitInputSchema } from "./cameraStartOrbit.js";
import { cameraStartOrbitInputShape } from "./cameraStartOrbit.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules on one side without the other.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "speed and clockwise direction", input: { speed: 2, direction: "clockwise" }, valid: true }, // prettier-ignore
  { name: "empty object", input: {}, valid: true },
  { name: "speed only", input: { speed: 1.5 }, valid: true },
  { name: "clockwise direction only", input: { direction: "clockwise" }, valid: true },
  { name: "counterclockwise direction only", input: { direction: "counterclockwise" }, valid: true }, // prettier-ignore
  { name: "speed lower bound 0.1", input: { speed: 0.1 }, valid: true },
  { name: "speed upper bound 10", input: { speed: 10 }, valid: true },
  { name: "speed below range", input: { speed: 0.0999 }, valid: false },
  { name: "speed above range", input: { speed: 10.0001 }, valid: false },
  { name: "invalid direction enum", input: { direction: "left" }, valid: false },
  { name: "wrong speed type", input: { speed: "2" }, valid: false },
  { name: "wrong direction type", input: { direction: true }, valid: false },
];

describe("cameraStartOrbit schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultCameraStartOrbitInputSchema.safeParse(input).success;
      const frontend = cameraStartOrbitInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
