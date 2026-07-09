import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";

/**
 * Unit tests for this app's server-executed `executeCesiumCode` tool. We mock
 * `@cesium-ai/codegen-cesium`'s `generateVerifiedCesiumCode` (the actual
 * generation/verification pipeline is that package's own responsibility) and
 * assert the tool's `execute` maps its result shapes correctly and never
 * throws, even when the pipeline itself throws unexpectedly.
 */
const generateVerifiedCesiumCode = vi.fn();
vi.mock("@cesium-ai/codegen-cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cesium-ai/codegen-cesium")>();
  return {
    ...actual,
    generateVerifiedCesiumCode: (...args: unknown[]) => generateVerifiedCesiumCode(...args),
  };
});

const { createExecuteCesiumCodeTool } = await import("./execute-cesium-code-tool.js");

const fakeModel = {} as LanguageModel;

describe("createExecuteCesiumCodeTool", () => {
  it("returns { code } when generation succeeds", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.flyTo({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel });
    const result = await cesiumTool.execute!(
      { intent: "fly to Paris" },
      {
        toolCallId: "call-1",
        messages: [],
        context: undefined,
      },
    );

    expect(result).toEqual({ code: "viewer.camera.flyTo({});" });
    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "fly to Paris",
      model: fakeModel,
    });
  });

  it("returns { error } when generation fails verification", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: false,
      error: "Generated code failed static AST verification after all attempts.",
      violations: ["disallowed identifier: fetch"],
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel });
    const result = await cesiumTool.execute!(
      { intent: "do something unsafe" },
      {
        toolCallId: "call-2",
        messages: [],
        context: undefined,
      },
    );

    expect(result).toEqual({
      error: "Generated code failed static AST verification after all attempts.",
    });
  });

  it("never throws — an unexpected pipeline failure returns error", async () => {
    generateVerifiedCesiumCode.mockRejectedValueOnce(new Error("network blip"));

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel });
    const result = await cesiumTool.execute!(
      { intent: "fly to Tokyo" },
      {
        toolCallId: "call-3",
        messages: [],
        context: undefined,
      },
    );

    expect(result).toEqual({ error: "network blip" });
  });
});
