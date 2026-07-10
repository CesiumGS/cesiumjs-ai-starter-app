import { describe, expect, it } from "vitest";
import { EasingFunction } from "cesium";
import { EASING_FUNCTION_NAMES } from "@cesium-ai/sample-config";

/**
 * `frontend/src/tools/camera.ts` indexes into the real Cesium `EasingFunction`
 * object with a name straight out of `EASING_FUNCTION_NAMES`
 * (`EasingFunction[easingFunction]`) rather than a hand-kept mapping table.
 * That's only safe so long as every name in the shared list actually matches
 * a real property on Cesium's `EasingFunction` — this test is the guardrail:
 * if someone edits `flyto-schema.ts` and typos or invents a preset name, the
 * lookup would silently resolve to `undefined` at runtime (Cesium then falls
 * back to its own default easing without any error), and only this test would
 * catch that.
 */
describe("EASING_FUNCTION_NAMES vs real Cesium EasingFunction", () => {
  it("every declared name resolves to a real Cesium EasingFunction preset", () => {
    for (const name of EASING_FUNCTION_NAMES) {
      const preset = EasingFunction[name as keyof typeof EasingFunction];
      expect(preset, `EasingFunction.${name} should exist`).toBeTypeOf("function");
    }
  });

  it("has no duplicate names", () => {
    expect(new Set(EASING_FUNCTION_NAMES).size).toBe(EASING_FUNCTION_NAMES.length);
  });
});
