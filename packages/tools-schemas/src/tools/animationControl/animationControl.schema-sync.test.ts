import { describe, expect, test } from "vitest";
import { defaultAnimationControlInputSchema } from "./animationControl.js";
import { animationControlInputShape } from "./animationControl.schema.js";

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
  { name: "play action", input: { animationId: "a1", action: "play" }, valid: true },
  { name: "pause action", input: { animationId: "a1", action: "pause" }, valid: true },
  { name: "missing animationId", input: { action: "play" }, valid: false },
  { name: "missing action", input: { animationId: "a1" }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "invalid enum", input: { animationId: "a1", action: "stop" }, valid: false },
  { name: "wrong type", input: { animationId: "a1", action: true }, valid: false },
];

describe("animationControl schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationControlInputSchema.safeParse(input).success;
      const frontend = animationControlInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
