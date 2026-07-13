import { describe, expect, test } from "vitest";
import { defaultAnimationUpdatePathInputSchema } from "./animationUpdatePath.js";
import { animationUpdatePathInputShape } from "./animationUpdatePath.schema.js";

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
  { name: "required field only", input: { animationId: "a1" }, valid: true },
  { name: "with lead time", input: { animationId: "a1", leadTime: 10 }, valid: true },
  { name: "with trail time", input: { animationId: "a1", trailTime: 20 }, valid: true },
  { name: "with width", input: { animationId: "a1", width: 4 }, valid: true },
  {
    name: "with color",
    input: { animationId: "a1", color: { red: 0.2, green: 0.4, blue: 0.6 } },
    valid: true,
  },
  {
    name: "with alpha",
    input: { animationId: "a1", color: { red: 0.2, green: 0.4, blue: 0.6, alpha: 0.8 } },
    valid: true,
  },
  { name: "lead time lower bound", input: { animationId: "a1", leadTime: 0 }, valid: true },
  {
    name: "lead time below range",
    input: { animationId: "a1", leadTime: -0.0001 },
    valid: false,
  },
  { name: "trail time lower bound", input: { animationId: "a1", trailTime: 0 }, valid: true },
  {
    name: "trail time below range",
    input: { animationId: "a1", trailTime: -0.0001 },
    valid: false,
  },
  { name: "width smallest positive", input: { animationId: "a1", width: 0.0001 }, valid: true },
  { name: "width zero", input: { animationId: "a1", width: 0 }, valid: false },
  {
    name: "color component lower bounds",
    input: { animationId: "a1", color: { red: 0, green: 0, blue: 0, alpha: 0 } },
    valid: true,
  },
  {
    name: "color component upper bounds",
    input: { animationId: "a1", color: { red: 1, green: 1, blue: 1, alpha: 1 } },
    valid: true,
  },
  {
    name: "red above range",
    input: { animationId: "a1", color: { red: 1.0001, green: 0, blue: 0 } },
    valid: false,
  },
  {
    name: "green below range",
    input: { animationId: "a1", color: { red: 0, green: -0.0001, blue: 0 } },
    valid: false,
  },
  {
    name: "blue above range",
    input: { animationId: "a1", color: { red: 0, green: 0, blue: 1.0001 } },
    valid: false,
  },
  {
    name: "alpha below range",
    input: { animationId: "a1", color: { red: 0, green: 0, blue: 0, alpha: -0.0001 } },
    valid: false,
  },
  {
    name: "alpha above range",
    input: { animationId: "a1", color: { red: 0, green: 0, blue: 0, alpha: 1.0001 } },
    valid: false,
  },
  { name: "missing animationId", input: { width: 4 }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong type", input: { animationId: "a1", width: "4" }, valid: false },
];

describe("animationUpdatePath schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationUpdatePathInputSchema.safeParse(input).success;
      const frontend = animationUpdatePathInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
