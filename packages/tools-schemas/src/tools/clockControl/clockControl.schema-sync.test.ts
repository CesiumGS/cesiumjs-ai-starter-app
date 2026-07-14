import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultClockControlInputSchema } from "./clockControl.js";
import { clockControlInputShape } from "./clockControl.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, types, enums) on one
 * side without the other — e.g. by hardcoding constraints inside
 * `buildClockControlInputSchema` instead of deriving them from the shared
 * `clockControlInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "configure with full clock",
    input: {
      action: "configure",
      clock: {
        startTime: "2026-01-01T00:00:00Z",
        stopTime: "2026-01-01T01:00:00Z",
        currentTime: "2026-01-01T00:30:00Z",
        clockRange: "LOOP_STOP",
        multiplier: 2,
        shouldAnimate: true,
      },
    },
    valid: true,
  },
  { name: "setTime with currentTime", input: { action: "setTime", currentTime: "2026-01-01T00:00:00Z" }, valid: true }, // prettier-ignore
  { name: "setMultiplier with multiplier", input: { action: "setMultiplier", multiplier: 100 }, valid: true }, // prettier-ignore
  { name: "clock omitted", input: { action: "configure" }, valid: true },
  { name: "currentTime omitted", input: { action: "setTime" }, valid: true },
  { name: "multiplier omitted", input: { action: "setMultiplier" }, valid: true },
  { name: "action configure", input: { action: "configure" }, valid: true },
  { name: "action setTime", input: { action: "setTime" }, valid: true },
  { name: "action setMultiplier", input: { action: "setMultiplier" }, valid: true },
  {
    name: "clockRange UNBOUNDED",
    input: { action: "configure", clock: { clockRange: "UNBOUNDED" } },
    valid: true,
  },
  {
    name: "clockRange CLAMPED",
    input: { action: "configure", clock: { clockRange: "CLAMPED" } },
    valid: true,
  },
  {
    name: "clockRange LOOP_STOP",
    input: { action: "configure", clock: { clockRange: "LOOP_STOP" } },
    valid: true,
  },
  { name: "invalid action enum", input: { action: "pause" }, valid: false },
  {
    name: "invalid clockRange enum",
    input: { action: "configure", clock: { clockRange: "REVERSE" } },
    valid: false,
  },
  { name: "missing action", input: { multiplier: 100 }, valid: false },
  { name: "empty object", input: {}, valid: false },
  { name: "wrong multiplier type", input: { action: "setMultiplier", multiplier: "100" }, valid: false }, // prettier-ignore
  {
    name: "wrong nested boolean type",
    input: { action: "configure", clock: { shouldAnimate: "yes" } },
    valid: false,
  },
];

describe("clockControl schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultClockControlInputSchema.safeParse(input).success;
      const frontend = clockControlInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
