import { describe, expect, test } from "vitest";
import { defaultAnimationRemoveInputSchema } from "./animationRemove.js";
import { animationRemoveInputShape } from "./animationRemove.schema.js";

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
  { name: "required field present", input: { animationId: "a1" }, valid: true },
  { name: "empty string ID", input: { animationId: "" }, valid: true },
  { name: "missing animationId", input: {}, valid: false },
  { name: "wrong type", input: { animationId: 123 }, valid: false },
];

describe("animationRemove schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationRemoveInputSchema.safeParse(input).success;
      const frontend = animationRemoveInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
