import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultCameraOrbitInputSchema } from "./cameraOrbit.js";
import { cameraOrbitInputShape } from "./cameraOrbit.schema.js";

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
  { name: "start with speed and clockwise direction", input: { action: "start", speed: 2, direction: "clockwise" }, valid: true }, // prettier-ignore
  { name: "start with no extra fields", input: { action: "start" }, valid: true },
  { name: "start speed only", input: { action: "start", speed: 1.5 }, valid: true },
  { name: "start clockwise direction only", input: { action: "start", direction: "clockwise" }, valid: true }, // prettier-ignore
  { name: "start counterclockwise direction only", input: { action: "start", direction: "counterclockwise" }, valid: true }, // prettier-ignore
  { name: "start speed lower bound 0.1", input: { action: "start", speed: 0.1 }, valid: true },
  { name: "start speed upper bound 10", input: { action: "start", speed: 10 }, valid: true },
  { name: "start speed below range", input: { action: "start", speed: 0.0999 }, valid: false },
  { name: "start speed above range", input: { action: "start", speed: 10.0001 }, valid: false },
  { name: "start invalid direction enum", input: { action: "start", direction: "left" }, valid: false }, // prettier-ignore
  { name: "start wrong speed type", input: { action: "start", speed: "2" }, valid: false },
  { name: "start wrong direction type", input: { action: "start", direction: true }, valid: false },
  { name: "stop with no extra fields", input: { action: "stop" }, valid: true },
  { name: "stop ignores unexpected extra field", input: { action: "stop", immediate: true }, valid: true }, // prettier-ignore
  { name: "unknown action", input: { action: "pause" }, valid: false },
  { name: "missing action", input: {}, valid: false },
  { name: "string input", input: "not-an-object", valid: false },
  { name: "null input", input: null, valid: false },
];

describe("cameraOrbit schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultCameraOrbitInputSchema.safeParse(input).success;
      const frontend = cameraOrbitInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
