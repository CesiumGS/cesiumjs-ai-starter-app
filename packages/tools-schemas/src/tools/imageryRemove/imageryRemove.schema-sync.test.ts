import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultImageryRemoveInputSchema } from "./imageryRemove.js";
import { imageryRemoveInputShape } from "./imageryRemove.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (types, numeric bounds) on one
 * side without the other — e.g. by hardcoding constraints inside
 * `buildImageryRemoveInputSchema` instead of deriving them from the shared
 * `imageryRemoveInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "empty object", input: {}, valid: true },
  { name: "index included", input: { index: 2 }, valid: true },
  { name: "name included", input: { name: "Overlay" }, valid: true },
  { name: "removeAll included", input: { removeAll: true }, valid: true },
  { name: "index lower bound 0", input: { index: 0 }, valid: true },
  { name: "index below range", input: { index: -1 }, valid: false },
  { name: "index non-integer", input: { index: 1.5 }, valid: false },
  { name: "wrong type", input: { removeAll: "yes" }, valid: false },
];

describe("imageryRemove schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultImageryRemoveInputSchema.safeParse(input).success;
      const frontend = imageryRemoveInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
