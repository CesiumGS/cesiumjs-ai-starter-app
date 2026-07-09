import { describe, expect, it, vi, beforeEach } from "vitest";

const generateTextMock = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

// Imported after the mock so the module under test picks up the mocked `ai` export.
const { generateVerifiedCesiumCode } = await import("./generate-verified-cesium-code.js");

const fakeModel = {} as never; // Opaque `LanguageModel` stand-in — never actually invoked directly.

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("generateVerifiedCesiumCode", () => {
  it("returns verified code on the first attempt when generation passes verification", async () => {
    generateTextMock.mockResolvedValueOnce({
      text: `viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(2.35, 48.85, 1000) });`,
    });

    const result = await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
      model: fakeModel,
    });

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.code).toContain("viewer.camera.flyTo");
    }
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences from the model's raw output", async () => {
    generateTextMock.mockResolvedValueOnce({
      text: "```javascript\nviewer.camera.flyTo({ destination: undefined });\n```",
    });

    const result = await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
      model: fakeModel,
    });

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.code.startsWith("```")).toBe(false);
    }
  });

  it("retries once with violation feedback and succeeds on the second attempt", async () => {
    generateTextMock
      .mockResolvedValueOnce({ text: `fetch("https://evil.example.com");` })
      .mockResolvedValueOnce({ text: `viewer.camera.flyTo({ destination: undefined });` });

    const result = await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
      model: fakeModel,
      maxAttempts: 2,
    });

    expect(result.verified).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(2);

    // Second call's prompt should include feedback about the first attempt's violation.
    const secondCallArgs = generateTextMock.mock.calls[1][0] as { prompt: string };
    expect(secondCallArgs.prompt).toMatch(/fetch/i);
  });

  it("returns verified:false with violations after exhausting all attempts", async () => {
    generateTextMock.mockResolvedValue({ text: `fetch("https://evil.example.com");` });

    const result = await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
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

  it("never calls generateText more than maxAttempts times", async () => {
    generateTextMock.mockResolvedValue({ text: `eval("bad");` });

    await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
      model: fakeModel,
      maxAttempts: 3,
    });

    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });
});
