import { describe, expect, it, beforeEach, vi } from "vitest";

const generateTextMock = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  tool: (options: unknown) => options,
  stepCountIs: (steps: number) => ({ type: "stepCountIs", steps }),
  Output: { object: (options: unknown) => options },
}));

// Imported after the mock so the module under test picks up the mocked `ai` export.
const { generateVerifiedCzml } = await import("./generate-verified-czml.js");

const fakeModel = {} as never; // Opaque `LanguageModel` stand-in — never actually invoked directly.

const VALID_OBJECT = {
  czml: [
    { id: "document", version: "1.0" },
    { id: "pt-1", position: { cartographicDegrees: [0, 0, 0] }, point: { pixelSize: 8 } },
  ],
  description: "A single marker",
};

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("generateVerifiedCzml", () => {
  it("returns verified CZML with an entity count on the first attempt", async () => {
    generateTextMock.mockResolvedValueOnce({ output: VALID_OBJECT });

    const result = await generateVerifiedCzml({ intent: "add a single marker", model: fakeModel });

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.description).toBe("A single marker");
      expect(result.entityCount).toBe(1);
    }
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with violation feedback and succeeds on the second attempt", async () => {
    generateTextMock
      .mockResolvedValueOnce({
        output: { czml: [{ id: "not-document" }], description: "broken" },
      })
      .mockResolvedValueOnce({ output: VALID_OBJECT });

    const result = await generateVerifiedCzml({
      intent: "add a single marker",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(2);

    const secondCallArgs = generateTextMock.mock.calls[1][0] as { prompt: string };
    expect(secondCallArgs.prompt).toMatch(/document packet/i);
  });

  it("returns verified:false with violations after exhausting all attempts", async () => {
    generateTextMock.mockResolvedValue({
      output: { czml: [{ id: "not-document" }], description: "still broken" },
    });

    const result = await generateVerifiedCzml({
      intent: "add a single marker",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.violations && result.violations.length).toBeGreaterThan(0);
      expect(result.error).toBeTruthy();
    }
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown model call as a failed attempt and retries", async () => {
    generateTextMock
      .mockRejectedValueOnce(new Error("model unavailable"))
      .mockResolvedValueOnce({ output: VALID_OBJECT });

    const result = await generateVerifiedCzml({
      intent: "add a single marker",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("defaults to 3 attempts when maxAttempts is omitted", async () => {
    generateTextMock.mockResolvedValue({
      output: { czml: [{ id: "not-document" }], description: "still broken" },
    });

    const result = await generateVerifiedCzml({ intent: "add a single marker", model: fakeModel });

    expect(result.verified).toBe(false);
    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });

  it("passes a loadSkill tool and a multi-step stopWhen so the model can load skills before finishing", async () => {
    generateTextMock.mockResolvedValueOnce({ output: VALID_OBJECT });

    await generateVerifiedCzml({ intent: "add a single marker", model: fakeModel });

    const callArgs = generateTextMock.mock.calls[0][0] as {
      tools: { loadSkill: { execute?: unknown } };
      stopWhen: { type: string; steps: number };
    };
    expect(callArgs.tools.loadSkill.execute).toBeTypeOf("function");
    expect(callArgs.stopWhen).toEqual({ type: "stepCountIs", steps: 6 });
  });
});

