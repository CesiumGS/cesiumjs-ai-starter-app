import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";

/**
 * Unit tests for this app's server-executed `generateCzml` tool. We mock
 * `@cesium-ai/codegen-czml`'s `generateVerifiedCzml` (the actual generation/verification
 * pipeline is that package's own responsibility) and assert the tool's `execute` maps its
 * result shapes correctly and never throws, even when the pipeline itself throws unexpectedly.
 */
const generateVerifiedCzml = vi.fn();
vi.mock("@cesium-ai/codegen-czml", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cesium-ai/codegen-czml")>();
  return {
    ...actual,
    generateVerifiedCzml: (...args: unknown[]) => generateVerifiedCzml(...args),
  };
});

const { createGenerateCzmlTool } = await import("./generate-czml-tool.js");

const fakeModel = {} as LanguageModel;
const fakeExecuteOptions = { toolCallId: "call-1", messages: [], context: undefined };

describe("createGenerateCzmlTool", () => {
  it("returns { czml, description } when generation succeeds", async () => {
    generateVerifiedCzml.mockResolvedValueOnce({
      verified: true,
      czml: [{ id: "document", version: "1.0" }],
      description: "A single marker",
      entityCount: 1,
    });

    const czmlTool = createGenerateCzmlTool({ model: fakeModel });
    const result = await czmlTool.execute!({ intent: "add a marker" }, fakeExecuteOptions);

    expect(result).toEqual({
      czml: [{ id: "document", version: "1.0" }],
      description: "A single marker",
    });
    expect(generateVerifiedCzml).toHaveBeenCalledWith({
      intent: "add a marker",
      model: fakeModel,
      maxAttempts: undefined,
      maxPackets: undefined,
      maxLength: undefined,
      extraInstructions: undefined,
      logger: undefined,
      metrics: undefined,
    });
  });

  it("returns { error } when generation fails verification", async () => {
    generateVerifiedCzml.mockResolvedValueOnce({
      verified: false,
      error: "Generated CZML failed verification after all attempts.",
    });

    const czmlTool = createGenerateCzmlTool({ model: fakeModel });
    const result = await czmlTool.execute!({ intent: "add a marker" }, fakeExecuteOptions);

    expect(result).toEqual({ error: "Generated CZML failed verification after all attempts." });
  });

  it("threads maxAttempts/maxPackets/maxLength/extraInstructions through when provided", async () => {
    generateVerifiedCzml.mockResolvedValueOnce({
      verified: true,
      czml: [{ id: "document", version: "1.0" }],
      description: "x",
      entityCount: 0,
    });

    const czmlTool = createGenerateCzmlTool({
      model: fakeModel,
      maxAttempts: 2,
      maxPackets: 10,
      maxLength: 500,
      extraInstructions: "Prefer metric units.",
    });
    await czmlTool.execute!({ intent: "add a marker" }, fakeExecuteOptions);

    expect(generateVerifiedCzml).toHaveBeenCalledWith({
      intent: "add a marker",
      model: fakeModel,
      maxAttempts: 2,
      maxPackets: 10,
      maxLength: 500,
      extraInstructions: "Prefer metric units.",
      logger: undefined,
      metrics: undefined,
    });
  });

  it("returns { error } instead of throwing when the pipeline itself throws", async () => {
    generateVerifiedCzml.mockRejectedValueOnce(new Error("boom"));

    const czmlTool = createGenerateCzmlTool({ model: fakeModel });
    const result = await czmlTool.execute!({ intent: "add a marker" }, fakeExecuteOptions);

    expect(result).toEqual({ error: "boom" });
  });
});
