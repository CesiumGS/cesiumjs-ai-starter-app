import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultCameraSetViewInputSchema } from "./cameraSetView.js";
import { cameraSetViewInputShape } from "./cameraSetView.schema.js";

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
  { name: "destination only", input: { destination: { longitude: 0, latitude: 0 } }, valid: true },
  {
    name: "with height and orientation",
    input: {
      destination: { longitude: 12.5, latitude: 48.1, height: 1500 },
      orientation: { heading: 90, pitch: -30, roll: 5 },
    },
    valid: true,
  },
  { name: "destination lat upper bound 90", input: { destination: { longitude: 0, latitude: 90 } }, valid: true }, // prettier-ignore
  { name: "destination lat lower bound -90", input: { destination: { longitude: 0, latitude: -90 } }, valid: true }, // prettier-ignore
  { name: "destination lon upper bound 180", input: { destination: { longitude: 180, latitude: 0 } }, valid: true }, // prettier-ignore
  { name: "destination lon lower bound -180", input: { destination: { longitude: -180, latitude: 0 } }, valid: true }, // prettier-ignore
  { name: "destination lat above range", input: { destination: { longitude: 0, latitude: 90.0001 } }, valid: false }, // prettier-ignore
  { name: "destination lon below range", input: { destination: { longitude: -180.0001, latitude: 0 } }, valid: false }, // prettier-ignore
  { name: "missing destination", input: { orientation: { heading: 90 } }, valid: false },
  { name: "missing destination longitude", input: { destination: { latitude: 10 } }, valid: false },
  { name: "missing destination latitude", input: { destination: { longitude: 10 } }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong destination type", input: { destination: { longitude: "0", latitude: 0 } }, valid: false }, // prettier-ignore
  { name: "wrong orientation type", input: { destination: { longitude: 0, latitude: 0 }, orientation: { heading: "90" } }, valid: false }, // prettier-ignore
];

describe("cameraSetView schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultCameraSetViewInputSchema.safeParse(input).success;
      const frontend = cameraSetViewInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
