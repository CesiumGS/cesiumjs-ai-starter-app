import { describe, expect, test, vi } from "vitest";
import type { Viewer } from "cesium";
import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas/names";
import {
  buildCesiumWebMcpTools,
  isWebMcpSupported,
  registerCesiumWebMcpTools,
} from "./register-cesium-webmcp-tools.js";
import type { WebMcpModelContext, WebMcpTool } from "./webmcp-types.js";

function fakeDocument(modelContext?: WebMcpModelContext): Document {
  return { modelContext } as unknown as Document;
}

function fakeModelContext(): WebMcpModelContext & { registered: WebMcpTool[] } {
  const registered: WebMcpTool[] = [];
  return {
    registered,
    registerTool: vi.fn(async (tool: WebMcpTool) => {
      registered.push(tool);
    }),
    getTools: vi.fn(async () => []),
    executeTool: vi.fn(async () => undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as WebMcpModelContext & { registered: WebMcpTool[] };
}

describe("isWebMcpSupported", () => {
  test("false when document.modelContext is absent", () => {
    expect(isWebMcpSupported(fakeDocument(undefined))).toBe(false);
  });

  test("true when document.modelContext is present", () => {
    expect(isWebMcpSupported(fakeDocument(fakeModelContext()))).toBe(true);
  });
});

describe("buildCesiumWebMcpTools", () => {
  test("builds one tool per CESIUM_TOOL_NAMES entry by default", () => {
    const tools = buildCesiumWebMcpTools({} as Viewer);
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(CESIUM_TOOL_NAMES).sort());
  });

  test("every tool has a plain-object JSON Schema, not a Zod schema", () => {
    const [flyTo] = buildCesiumWebMcpTools({} as Viewer, { enabled: [CESIUM_TOOL_NAMES.flyTo] });
    expect(flyTo.inputSchema).toMatchObject({ type: "object" });
    expect(flyTo.inputSchema).not.toHaveProperty("$schema");
  });

  test("enabled allowlists which tools are built", () => {
    const tools = buildCesiumWebMcpTools({} as Viewer, { enabled: [CESIUM_TOOL_NAMES.flyTo] });
    expect(tools.map((tool) => tool.name)).toEqual([CESIUM_TOOL_NAMES.flyTo]);
  });

  test("toolConfig: false excludes a tool", () => {
    const tools = buildCesiumWebMcpTools({} as Viewer, {
      toolConfig: { flyTo: false },
    });
    expect(tools.map((tool) => tool.name)).not.toContain(CESIUM_TOOL_NAMES.flyTo);
  });

  test("toolConfig.description overrides the default description", () => {
    const [flyTo] = buildCesiumWebMcpTools({} as Viewer, {
      enabled: [CESIUM_TOOL_NAMES.flyTo],
      toolConfig: { flyTo: { description: "Custom description." } },
    });
    expect(flyTo.description).toBe("Custom description.");
  });

  test("read-only tools are annotated readOnlyHint: true", () => {
    const [entityList] = buildCesiumWebMcpTools({} as Viewer, {
      enabled: [CESIUM_TOOL_NAMES.entityList],
    });
    expect(entityList.annotations?.readOnlyHint).toBe(true);
  });

  test("execute() runs the executor against the viewer and JSON-stringifies the result", async () => {
    const customFlyTo = vi.fn(async () => ({ success: true, custom: true }));
    const viewer = {} as Viewer;
    const [flyTo] = buildCesiumWebMcpTools(viewer, {
      enabled: [CESIUM_TOOL_NAMES.flyTo],
      executors: { flyTo: customFlyTo },
    });

    const result = await flyTo.execute({ latitude: 1, longitude: 2 });

    expect(customFlyTo).toHaveBeenCalledWith(viewer, { latitude: 1, longitude: 2 });
    expect(result).toBe(JSON.stringify({ success: true, custom: true }));
  });
});

describe("registerCesiumWebMcpTools", () => {
  test("no-ops when WebMCP isn't supported", async () => {
    const result = await registerCesiumWebMcpTools({} as Viewer, {
      document: fakeDocument(undefined),
    });
    expect(result.toolNames).toEqual([]);
  });

  test("registers every enabled tool on document.modelContext", async () => {
    const modelContext = fakeModelContext();
    const result = await registerCesiumWebMcpTools({} as Viewer, {
      document: fakeDocument(modelContext),
      enabled: [CESIUM_TOOL_NAMES.flyTo, CESIUM_TOOL_NAMES.entityList],
    });

    expect(modelContext.registerTool).toHaveBeenCalledTimes(2);
    expect(result.toolNames.sort()).toEqual(
      [CESIUM_TOOL_NAMES.flyTo, CESIUM_TOOL_NAMES.entityList].sort(),
    );
  });

  test("unregister aborts the shared signal passed to every registerTool call", async () => {
    const modelContext = fakeModelContext();
    const result = await registerCesiumWebMcpTools({} as Viewer, {
      document: fakeDocument(modelContext),
      enabled: [CESIUM_TOOL_NAMES.flyTo],
    });

    const [, options] = (modelContext.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.signal.aborted).toBe(false);

    result.unregister();

    expect(options.signal.aborted).toBe(true);
  });
});
