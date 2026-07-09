import { describe, expect, test } from "vitest";
import { createCesiumTools } from "./index.js";
import { CESIUM_TOOL_NAMES } from "./tool-names.js";

describe("createCesiumTools", () => {
  test("registers every tool by default", () => {
    const tools = createCesiumTools();

    expect(Object.keys(tools)).toEqual([CESIUM_TOOL_NAMES.flyTo]);
  });

  test("excludes a tool via its per-tool `false` override", () => {
    const tools = createCesiumTools({ flyTo: false });

    expect(tools).not.toHaveProperty(CESIUM_TOOL_NAMES.flyTo);
  });

  test("`enabled` allowlist admits only the named tools", () => {
    const tools = createCesiumTools({ enabled: [CESIUM_TOOL_NAMES.flyTo] });

    expect(Object.keys(tools)).toEqual([CESIUM_TOOL_NAMES.flyTo]);
  });

  test("an empty `enabled` allowlist yields no tools", () => {
    const tools = createCesiumTools({ enabled: [] });

    expect(tools).toEqual({});
  });

  test("`enabled` and a per-tool `false` compose — either can exclude", () => {
    const tools = createCesiumTools({ enabled: [CESIUM_TOOL_NAMES.flyTo], flyTo: false });

    expect(tools).toEqual({});
  });

  test("per-tool config overrides (e.g. description) reach the built tool", () => {
    const tools = createCesiumTools({ flyTo: { description: "Custom flyTo description." } });

    expect(tools[CESIUM_TOOL_NAMES.flyTo]?.description).toBe("Custom flyTo description.");
  });
});
