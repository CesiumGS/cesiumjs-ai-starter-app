import { describe, expect, test } from "vitest";
// Same schema-sync contract as `@cesium-ai/tools-cesium`'s own
// `schema-sync.test.ts`, but for this app's extension: the backend's
// model-facing `flyToInputSchema` (what the LLM sees) and the shared
// `flyToShape` (what the frontend's `flyToLocation` validates against) must
// agree on `duration` and `easingFunction`, not just the library's base
// lat/lon/altitude fields.
import { flyToShape } from "@cesium-ai/sample-config";
import { flyToInputSchema } from "./flyto-tool.js";

const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  { name: "base fields only", input: { latitude: 0, longitude: 0 }, valid: true },
  { name: "with duration", input: { latitude: 0, longitude: 0, duration: 3 }, valid: true },
  { name: "with easingFunction", input: { latitude: 0, longitude: 0, easingFunction: "QUADRATIC_IN_OUT" }, valid: true }, // prettier-ignore
  { name: "with duration and easingFunction", input: { latitude: 0, longitude: 0, duration: 3, easingFunction: "LINEAR_NONE" }, valid: true }, // prettier-ignore
  {
    name: "zero duration (non-positive)",
    input: { latitude: 0, longitude: 0, duration: 0 },
    valid: false,
  },
  { name: "negative duration", input: { latitude: 0, longitude: 0, duration: -1 }, valid: false },
  { name: "unknown easingFunction name", input: { latitude: 0, longitude: 0, easingFunction: "NOT_REAL" }, valid: false }, // prettier-ignore
];

describe("flyTo extended schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = flyToInputSchema.safeParse(input).success;
      const frontend = flyToShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
