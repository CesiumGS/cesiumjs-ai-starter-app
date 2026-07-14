import { describe, expect, test } from "vitest";
import { defaultAnimationListActiveInputSchema } from "./animationListActive.js";
import { animationListActiveInputShape } from "./animationListActive.schema.js";

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
  { name: "non-object null", input: null, valid: false },
  { name: "non-object string", input: "list", valid: false },
];

describe("animationListActive schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationListActiveInputSchema.safeParse(input).success;
      const frontend = animationListActiveInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
