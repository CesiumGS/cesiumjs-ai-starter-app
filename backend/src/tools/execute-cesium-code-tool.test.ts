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

  it("threads maxSkills through to generateVerifiedCesiumCode when provided", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.flyTo({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel, maxSkills: 3 });
    await cesiumTool.execute!(
      { intent: "fly to Paris" },
      {
        toolCallId: "call-1b",
        messages: [],
        context: undefined,
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "fly to Paris",
      model: fakeModel,
      maxSkills: 3,
    });
  });

  it("threads maxAttempts through to generateVerifiedCesiumCode when provided", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.flyTo({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel, maxAttempts: 5 });
    await cesiumTool.execute!(
      { intent: "fly to Paris" },
      {
        toolCallId: "call-1c",
        messages: [],
        context: undefined,
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "fly to Paris",
      model: fakeModel,
      maxAttempts: 5,
    });
  });

  it("threads maxLength, maxLines, and allowedSymbols through to generateVerifiedCesiumCode when provided", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.flyTo({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({
      model: fakeModel,
      maxLength: 2000,
      maxLines: 50,
      allowedSymbols: ["viewer"],
    });
    await cesiumTool.execute!(
      { intent: "fly to Paris" },
      {
        toolCallId: "call-1d",
        messages: [],
        context: undefined,
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "fly to Paris",
      model: fakeModel,
      maxLength: 2000,
      maxLines: 50,
      allowedSymbols: ["viewer"],
    });
  });

  it("threads extraInstructions through to generateVerifiedCesiumCode when provided", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.flyTo({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({
      model: fakeModel,
      extraInstructions: "Prefer flat styling.",
    });
    await cesiumTool.execute!(
      { intent: "fly to Paris" },
      {
        toolCallId: "call-1e",
        messages: [],
        context: undefined,
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "fly to Paris",
      model: fakeModel,
      extraInstructions: "Prefer flat styling.",
    });
  });

  it("threads the latest sandbox execution error and previous code into a retry generation", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "const tileset = await Cesium.createOsmBuildingsAsync();",
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel });
    await cesiumTool.execute!(
      { intent: "show OSM buildings" },
      {
        toolCallId: "call-retry",
        context: undefined,
        messages: [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-original",
                toolName: "executeCesiumCode",
                output: {
                  type: "json",
                  value: {
                    code: "viewer.scene.primitives.add(Cesium.createOsmBuildingsAsync());",
                    executionError: "A Promise cannot be passed to a Cesium API.",
                  },
                },
              },
            ],
          },
        ],
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenCalledWith({
      intent: "show OSM buildings",
      model: fakeModel,
      runtimeFeedback: {
        previousCode: "viewer.scene.primitives.add(Cesium.createOsmBuildingsAsync());",
        executionError: "A Promise cannot be passed to a Cesium API.",
      },
    });
  });

  it("does not reuse an older runtime error after a later execution succeeds", async () => {
    generateVerifiedCesiumCode.mockResolvedValueOnce({
      verified: true,
      code: "viewer.camera.setView({});",
    });

    const cesiumTool = createExecuteCesiumCodeTool({ model: fakeModel });
    await cesiumTool.execute!(
      { intent: "change the camera" },
      {
        toolCallId: "call-after-success",
        context: undefined,
        messages: [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-failed",
                toolName: "executeCesiumCode",
                output: {
                  type: "json",
                  value: { code: "bad();", executionError: "not a function" },
                },
              },
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-succeeded",
                toolName: "executeCesiumCode",
                output: { type: "json", value: { code: "viewer.camera.setView({});" } },
              },
            ],
          },
        ],
      },
    );

    expect(generateVerifiedCesiumCode).toHaveBeenLastCalledWith({
      intent: "change the camera",
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
