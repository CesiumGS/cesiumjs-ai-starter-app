import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultCameraSetControllerOptionsInputSchema } from "./cameraSetControllerOptions.js";
import { cameraSetControllerOptionsInputShape } from "./cameraSetControllerOptions.schema.js";

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
  { name: "empty object", input: {}, valid: true },
  {
    name: "all boolean toggles",
    input: {
      enableRotate: true,
      enableTranslate: false,
      enableZoom: true,
      enableTilt: false,
      enableLook: true,
      enableCollisionDetection: false,
    },
    valid: true,
  },
  { name: "with maximum zoom distance", input: { enableZoom: false, maximumZoomDistance: 20000 }, valid: true }, // prettier-ignore
  { name: "with minimum zoom distance", input: { minimumZoomDistance: 1 }, valid: true },
  { name: "maximum zoom distance tiny positive", input: { maximumZoomDistance: 0.0001 }, valid: true }, // prettier-ignore
  { name: "minimum zoom distance tiny positive", input: { minimumZoomDistance: 0.0001 }, valid: true }, // prettier-ignore
  { name: "maximum zoom distance zero", input: { maximumZoomDistance: 0 }, valid: false },
  { name: "minimum zoom distance zero", input: { minimumZoomDistance: 0 }, valid: false },
  { name: "maximum zoom distance negative", input: { maximumZoomDistance: -5 }, valid: false },
  { name: "minimum zoom distance negative", input: { minimumZoomDistance: -5 }, valid: false },
  { name: "wrong boolean type", input: { enableZoom: "false" }, valid: false },
  { name: "wrong number type", input: { minimumZoomDistance: "10" }, valid: false },
];

describe("cameraSetControllerOptions schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultCameraSetControllerOptionsInputSchema.safeParse(input).success;
      const frontend = cameraSetControllerOptionsInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
