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

  it("defaults to 3 attempts when maxAttempts is omitted", async () => {
    generateTextMock.mockResolvedValue({ text: `eval("bad");` });

    const result = await generateVerifiedCesiumCode({
      intent: "xyzzy plugh qux totally unrelated nonsense request",
      model: fakeModel,
    });

    expect(result.verified).toBe(false);
    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });

  describe("maxSkills", () => {
    const intent =
      "convert between Cartesian3 and Cartographic coordinates using Transforms and Ellipsoid";

    it("defaults to grounding the prompt with only the single top-matched skill when omitted", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.entities.add({});` });

      await generateVerifiedCesiumCode({ intent, model: fakeModel });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).toContain("Reference: cesiumjs-spatial-math");
      expect(prompt).not.toContain("Reference: cesiumjs-camera");
    });

    it("threads a raised maxSkills through to buildCodegenPrompt, grounding with multiple matched skills", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.entities.add({});` });

      await generateVerifiedCesiumCode({ intent, model: fakeModel, maxSkills: 2 });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).toContain("Reference: cesiumjs-spatial-math");
      expect(prompt).toContain("Reference: cesiumjs-camera");
    });
  });

  describe("maxLength / maxLines / allowedSymbols", () => {
    it("threads a restrictive allowedSymbols list through to verifyCesiumCode, rejecting a disallowed free identifier", async () => {
      generateTextMock.mockResolvedValue({ text: `helper.doSomething();` });

      const result = await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        allowedSymbols: ["viewer"],
      });

      expect(result.verified).toBe(false);
      if (!result.verified) {
        expect(result.violations?.some((v) => /disallowed identifier `helper`/.test(v))).toBe(true);
      }
    });

    it("threads a small maxLength through to verifyCesiumCode, rejecting oversized generated code", async () => {
      generateTextMock.mockResolvedValue({ text: `viewer.camera.flyTo({ destination: undefined });` });

      const result = await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        maxLength: 10,
      });

      expect(result.verified).toBe(false);
      if (!result.verified) {
        expect(result.violations?.some((v) => /maximum length/.test(v))).toBe(true);
      }
    });

    it("threads a small maxLines through to verifyCesiumCode, rejecting generated code with too many lines", async () => {
      generateTextMock.mockResolvedValue({ text: "const a = 1;\nconst b = 2;\nconst c = 3;" });

      const result = await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        maxLines: 1,
      });

      expect(result.verified).toBe(false);
      if (!result.verified) {
        expect(result.violations?.some((v) => /maximum line count/.test(v))).toBe(true);
      }
    });
  });

  describe("extraInstructions", () => {
    it("threads extraInstructions through to buildCodegenPrompt, appearing in the generation prompt", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });

      await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        extraInstructions: "Always prefer Cartesian3.fromDegrees over fromRadians.",
      });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).toContain("Always prefer Cartesian3.fromDegrees over fromRadians.");
    });

    it("omits the extra-instructions section when not provided", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });

      await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
      });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).not.toContain("Additional instructions from the host application:");
    });
  });
});
