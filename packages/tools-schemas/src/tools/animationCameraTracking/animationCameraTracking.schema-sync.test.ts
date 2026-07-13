import { describe, expect, test } from "vitest";
import { defaultAnimationCameraTrackingInputSchema } from "./animationCameraTracking.js";
import { animationCameraTrackingInputShape } from "./animationCameraTracking.schema.js";

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
  { name: "required fields only", input: { animationId: "a1", track: true }, valid: true },
  { name: "track false", input: { animationId: "a1", track: false }, valid: true },
  { name: "with range", input: { animationId: "a1", track: true, range: 1000 }, valid: true },
  { name: "with pitch", input: { animationId: "a1", track: true, pitch: -45 }, valid: true },
  { name: "with heading", input: { animationId: "a1", track: true, heading: 90 }, valid: true },
  {
    name: "with all optional fields",
    input: { animationId: "a1", track: true, range: 750, pitch: -30, heading: 180 },
    valid: true,
  },
  {
    name: "range smallest positive",
    input: { animationId: "a1", track: true, range: 0.0001 },
    valid: true,
  },
  { name: "range zero", input: { animationId: "a1", track: true, range: 0 }, valid: false },
  {
    name: "range negative",
    input: { animationId: "a1", track: true, range: -1 },
    valid: false,
  },
  { name: "missing animationId", input: { track: true }, valid: false },
  { name: "missing track", input: { animationId: "a1" }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong type", input: { animationId: "a1", track: "true" }, valid: false },
];

describe("animationCameraTracking schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationCameraTrackingInputSchema.safeParse(input).success;
      const frontend = animationCameraTrackingInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
