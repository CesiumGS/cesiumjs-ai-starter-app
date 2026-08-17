import { describe, expect, test, vi } from "vitest";
import type { Viewer } from "cesium";
import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas/names";
import { createCesiumToolExecutors, DEFAULT_CESIUM_TOOL_EXECUTORS } from "./index.js";
import type { ToolsLogger } from "./logger.js";

describe("DEFAULT_CESIUM_TOOL_EXECUTORS", () => {
  test("has exactly one executor per CESIUM_TOOL_NAMES entry", () => {
    const expectedNames = Object.values(CESIUM_TOOL_NAMES).sort();
    const actualNames = Object.keys(DEFAULT_CESIUM_TOOL_EXECUTORS).sort();
    expect(actualNames).toEqual(expectedNames);
  });

  test("every default executor is a function", () => {
    for (const executor of Object.values(DEFAULT_CESIUM_TOOL_EXECUTORS)) {
      expect(typeof executor).toBe("function");
    }
  });
});

describe("createCesiumToolExecutors", () => {
  test("returns the defaults unchanged when called with no overrides", () => {
    expect(createCesiumToolExecutors()).toEqual(DEFAULT_CESIUM_TOOL_EXECUTORS);
  });

  test("overrides only the given tool, leaving every other default untouched", async () => {
    const customFlyTo = async () => ({ success: true, custom: true }) as const;

    const executors = createCesiumToolExecutors({ flyTo: customFlyTo });

    expect(executors.flyTo).toBe(customFlyTo);
    expect(await executors.flyTo({} as Viewer, {})).toEqual({ success: true, custom: true });
    // Every other tool keeps its default implementation.
    expect(executors.entityList).toBe(DEFAULT_CESIUM_TOOL_EXECUTORS.entityList);
  });

  test("overrides a tool with no dedicated extend-factory just as well as one with a factory", async () => {
    // globeSetLighting/entityAdd/animationCreate/imageryAdd/etc. are all plain functions with no
    // createXExecutor — full override via createCesiumToolExecutors works identically for every tool
    // in the catalogue, factory or not.
    const customGlobeSetLighting = async () => ({ success: true, custom: true }) as const;

    const executors = createCesiumToolExecutors({ globeSetLighting: customGlobeSetLighting });

    expect(executors.globeSetLighting).toBe(customGlobeSetLighting);
    expect(await executors.globeSetLighting({} as Viewer, {})).toEqual({
      success: true,
      custom: true,
    });
    expect(executors.entityAdd).toBe(DEFAULT_CESIUM_TOOL_EXECUTORS.entityAdd);
  });

  test("overriding multiple tools at once only replaces those tools", () => {
    const customEntityList = async () => ({ success: true, custom: "entityList" }) as const;
    const customImageryList = async () => ({ success: true, custom: "imageryList" }) as const;

    const executors = createCesiumToolExecutors({
      entityList: customEntityList,
      imageryList: customImageryList,
    });

    expect(executors.entityList).toBe(customEntityList);
    expect(executors.imageryList).toBe(customImageryList);
    expect(executors.flyTo).toBe(DEFAULT_CESIUM_TOOL_EXECUTORS.flyTo);
  });
});

describe("createCesiumToolExecutors's logger option", () => {
  function fakeLogger(): ToolsLogger {
    return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  }

  test("omitting logger returns executors unwrapped (no behavior change)", () => {
    expect(createCesiumToolExecutors()).toEqual(DEFAULT_CESIUM_TOOL_EXECUTORS);
  });

  test("reports a successful call via logger.debug", async () => {
    const logger = fakeLogger();

    const executors = createCesiumToolExecutors({ flyTo: async () => ({ success: true }) }, logger);
    await executors.flyTo({} as Viewer, {});

    expect(logger.debug).toHaveBeenCalledWith("Tool call succeeded: flyTo");
  });

  test("reports a resolved { error } via logger.warn", async () => {
    const logger = fakeLogger();

    const executors = createCesiumToolExecutors(
      { flyTo: async () => ({ success: false, error: "bad args" }) },
      logger,
    );
    await executors.flyTo({} as Viewer, {});

    expect(logger.warn).toHaveBeenCalledWith("Tool call failed: flyTo", { error: "bad args" });
  });

  test("reports a thrown rejection via logger.error and still rejects", async () => {
    const logger = fakeLogger();

    const executors = createCesiumToolExecutors(
      {
        flyTo: async () => {
          throw new Error("boom");
        },
      },
      logger,
    );

    await expect(executors.flyTo({} as Viewer, {})).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledWith("Tool call threw: flyTo", { error: "boom" });
  });
});
