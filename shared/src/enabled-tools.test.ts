import { describe, expect, test } from "vitest";
// The app's tool selection lives in ONE shared place; this test pins the
// contract that the backend registry (viewer tools) and the codegen-cesium
// tool names together cover exactly that selection.
import { createCesiumTools, CESIUM_TOOL_NAMES } from "@cesium-ai/tools-cesium";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium";
import { ENABLED_CESIUM_TOOLS } from "./enabled-tools.js";

/**
 * Enabled-tools allowlist contract.
 *
 * `ENABLED_CESIUM_TOOLS` is the single source of truth for which tools this
 * sample app turns on, spanning two packages: `@cesium-ai/tools-cesium`'s
 * viewer tools (built into a `ToolSet` by `createCesiumTools`) and
 * `@cesium-ai/codegen-cesium`'s `executeCesiumCode` (built into its own
 * server-executed tool by `backend/src/tools/execute-cesium-code-tool.ts`,
 * not by `createCesiumTools`). These assertions guard the seam where all
 * three — the allowlist, the viewer registry, and the codegen tool name —
 * agree on the app's tool surface.
 */
describe("enabled-tools allowlist", () => {
  test("createCesiumTools registers exactly the enabled VIEWER tools", () => {
    const registered = Object.keys(createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })).sort();
    const enabledViewerTools = ENABLED_CESIUM_TOOLS.filter(
      (name): name is typeof CESIUM_TOOL_NAMES.flyTo =>
        (Object.values(CESIUM_TOOL_NAMES) as readonly string[]).includes(name),
    ).sort();
    expect(registered).toEqual(enabledViewerTools);
  });

  test("every enabled name is a known viewer tool or the codegen-cesium executeCesiumCode tool", () => {
    const known = new Set([
      ...Object.values(CESIUM_TOOL_NAMES),
      ...Object.values(CODEGEN_CESIUM_TOOL_NAMES),
    ]);
    for (const name of ENABLED_CESIUM_TOOLS) {
      expect(known, `"${name}" is not a known tool name`).toContain(name);
    }
  });

  test("the allowlist actually restricts the viewer tool registry", () => {
    // An empty allowlist builds nothing — proving the list, not the defaults,
    // drives the surface.
    expect(Object.keys(createCesiumTools({ enabled: [] }))).toEqual([]);
    // A per-tool `false` still wins over the allowlist (the two compose).
    expect(Object.keys(createCesiumTools({ enabled: [CESIUM_TOOL_NAMES.flyTo], flyTo: false }))).toEqual([]); // prettier-ignore
  });
});
