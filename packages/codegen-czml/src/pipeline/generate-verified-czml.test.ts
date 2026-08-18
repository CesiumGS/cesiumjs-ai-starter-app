import { describe, expect, it, beforeEach, vi } from "vitest";

const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
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
  generateObjectMock.mockReset();
});

describe("generateVerifiedCzml", () => {
  it("returns verified CZML with an entity count on the first attempt", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: VALID_OBJECT });

    const result = await generateVerifiedCzml({ intent: "add a single marker", model: fakeModel });

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.description).toBe("A single marker");
      expect(result.entityCount).toBe(1);
    }
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with violation feedback and succeeds on the second attempt", async () => {
    generateObjectMock
      .mockResolvedValueOnce({
        object: { czml: [{ id: "not-document" }], description: "broken" },
      })
      .mockResolvedValueOnce({ object: VALID_OBJECT });

    const result = await generateVerifiedCzml({
      intent: "add a single marker",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(true);
    expect(generateObjectMock).toHaveBeenCalledTimes(2);

    const secondCallArgs = generateObjectMock.mock.calls[1][0] as { prompt: string };
    expect(secondCallArgs.prompt).toMatch(/document packet/i);
  });

  it("returns verified:false with violations after exhausting all attempts", async () => {
    generateObjectMock.mockResolvedValue({
      object: { czml: [{ id: "not-document" }], description: "still broken" },
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
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown model call as a failed attempt and retries", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("model unavailable"))
      .mockResolvedValueOnce({ object: VALID_OBJECT });

    const result = await generateVerifiedCzml({
      intent: "add a single marker",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(true);
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it("defaults to 3 attempts when maxAttempts is omitted", async () => {
    generateObjectMock.mockResolvedValue({
      object: { czml: [{ id: "not-document" }], description: "still broken" },
    });

    const result = await generateVerifiedCzml({ intent: "add a single marker", model: fakeModel });

    expect(result.verified).toBe(false);
    expect(generateObjectMock).toHaveBeenCalledTimes(3);
  });
});
