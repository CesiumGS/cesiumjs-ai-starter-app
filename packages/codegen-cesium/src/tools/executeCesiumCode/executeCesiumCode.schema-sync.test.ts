import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultExecuteCesiumCodeInputSchema } from "./executeCesiumCode.js";
import { executeCesiumCodeInputShape } from "./executeCesiumCode.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, types) on one side without the
 * other — e.g. by hardcoding constraints inside
 * `buildExecuteCesiumCodeInputSchema` instead of deriving them from the shared
 * `executeCesiumCodeInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "simple intent", input: { intent: "Fly to Paris and add a red marker" }, valid: true },
  { name: "single character intent", input: { intent: "x" }, valid: true },
  { name: "long intent", input: { intent: "A".repeat(2000) }, valid: true },
  { name: "empty string intent", input: { intent: "" }, valid: false },
  { name: "missing intent", input: {}, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong type (number)", input: { intent: 123 }, valid: false },
  { name: "wrong type (null)", input: { intent: null }, valid: false },
  { name: "wrong type (array)", input: { intent: ["fly to Paris"] }, valid: false },
  { name: "extra unrelated field", input: { intent: "fly to Paris", extra: true }, valid: true },
];

describe("executeCesiumCode schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultExecuteCesiumCodeInputSchema.safeParse(input).success;
      const frontend = executeCesiumCodeInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
