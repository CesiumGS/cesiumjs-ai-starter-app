import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultCameraLookAtTransformInputSchema } from "./cameraLookAtTransform.js";
import { cameraLookAtTransformInputShape } from "./cameraLookAtTransform.schema.js";

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
  { name: "target only", input: { target: { longitude: 0, latitude: 0 } }, valid: true },
  {
    name: "with target height and offset",
    input: {
      target: { longitude: 12.5, latitude: 48.1, height: 1500 },
      offset: { heading: 90, pitch: -30, range: 5000 },
    },
    valid: true,
  },
  { name: "target lat upper bound 90", input: { target: { longitude: 0, latitude: 90 } }, valid: true }, // prettier-ignore
  { name: "target lat lower bound -90", input: { target: { longitude: 0, latitude: -90 } }, valid: true }, // prettier-ignore
  { name: "target lon upper bound 180", input: { target: { longitude: 180, latitude: 0 } }, valid: true }, // prettier-ignore
  { name: "target lon lower bound -180", input: { target: { longitude: -180, latitude: 0 } }, valid: true }, // prettier-ignore
  { name: "offset range tiny positive", input: { target: { longitude: 0, latitude: 0 }, offset: { range: 0.0001 } }, valid: true }, // prettier-ignore
  { name: "target lat above range", input: { target: { longitude: 0, latitude: 90.0001 } }, valid: false }, // prettier-ignore
  { name: "target lon below range", input: { target: { longitude: -180.0001, latitude: 0 } }, valid: false }, // prettier-ignore
  { name: "offset range zero", input: { target: { longitude: 0, latitude: 0 }, offset: { range: 0 } }, valid: false }, // prettier-ignore
  { name: "offset range negative", input: { target: { longitude: 0, latitude: 0 }, offset: { range: -5 } }, valid: false }, // prettier-ignore
  { name: "missing target", input: { offset: { heading: 90 } }, valid: false },
  { name: "missing target longitude", input: { target: { latitude: 10 } }, valid: false },
  { name: "missing target latitude", input: { target: { longitude: 10 } }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong target type", input: { target: { longitude: "0", latitude: 0 } }, valid: false },
  { name: "wrong offset type", input: { target: { longitude: 0, latitude: 0 }, offset: { heading: "90" } }, valid: false }, // prettier-ignore
];

describe("cameraLookAtTransform schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultCameraLookAtTransformInputSchema.safeParse(input).success;
      const frontend = cameraLookAtTransformInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
