import { describe, expect, test } from "vitest";
// The app's tool selection lives in ONE shared place; this test pins the
// contract that the backend registry is built from exactly that selection.
import { createCesiumTools, CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas";
import { ENABLED_CESIUM_TOOLS } from "./enabled-tools.js";

/**
 * Enabled-tools allowlist contract.
 *
 * `ENABLED_CESIUM_TOOLS` is the single source of truth for which CesiumJS tools
 * this sample app turns on. The backend builds its registry from it and the
 * frontend keys its executor handling off it, so these assertions guard the
 * seam where the two sides agree on the app's tool surface.
 */
describe("enabled-tools allowlist", () => {
  test("backend registry exposes exactly the enabled tools", () => {
    const registered = Object.keys(createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })).sort();
    expect(registered).toEqual([...ENABLED_CESIUM_TOOLS].sort());
  });

  test("every enabled name is a real Cesium tool", () => {
    const known = new Set(Object.values(CESIUM_TOOL_NAMES));
    for (const name of ENABLED_CESIUM_TOOLS) {
      expect(known, `"${name}" is not a known Cesium tool name`).toContain(name);
    }
  });

  test("the allowlist actually restricts the registry", () => {
    // An empty allowlist builds nothing — proving the list, not the defaults,
    // drives the surface.
    expect(Object.keys(createCesiumTools({ enabled: [] }))).toEqual([]);
    // A per-tool `false` still wins over the allowlist (the two compose).
    expect(Object.keys(createCesiumTools({ enabled: [CESIUM_TOOL_NAMES.flyTo], flyTo: false }))).toEqual([]); // prettier-ignore
  });
});
