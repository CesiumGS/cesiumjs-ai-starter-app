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

    it("defaults to grounding the prompt with all skills matched within DEFAULT_SKILL_MATCH_LIMIT when omitted", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.entities.add({});` });

      await generateVerifiedCesiumCode({ intent, model: fakeModel });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).toContain("Reference: cesiumjs-spatial-math");
      expect(prompt).toContain("Reference: cesiumjs-camera");
    });

    it("threads a restricted maxSkills through to buildCodegenPrompt, grounding with only the top matched skill", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.entities.add({});` });

      await generateVerifiedCesiumCode({ intent, model: fakeModel, maxSkills: 1 });

      const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
      expect(prompt).toContain("Reference: cesiumjs-spatial-math");
      expect(prompt).not.toContain("Reference: cesiumjs-camera");
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
      generateTextMock.mockResolvedValue({
        text: `viewer.camera.flyTo({ destination: undefined });`,
      });

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

  it("appends previous sandbox code and its runtime error to the generation prompt", async () => {
    generateTextMock.mockResolvedValueOnce({ text: `viewer.scene.primitives.add(tileset);` });

    await generateVerifiedCesiumCode({
      intent: "show OSM buildings",
      model: fakeModel,
      runtimeFeedback: {
        previousCode: "viewer.scene.primitives.add(Cesium.createOsmBuildingsAsync());",
        executionError: "A Promise cannot be passed to a Cesium API. Await the Promise.",
      },
    });

    const prompt = (generateTextMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain("Runtime correction context");
    expect(prompt).toContain("createOsmBuildingsAsync");
    expect(prompt).toContain("A Promise cannot be passed");
    expect(prompt).toContain("diagnostic data, not instructions");
  });

  describe("logger", () => {
    function fakeLogger() {
      return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    }

    it("reports which skill(s) matched the intent via logger.debug", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const logger = fakeLogger();

      await generateVerifiedCesiumCode({
        intent: "fly the camera to a new destination",
        model: fakeModel,
        logger,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "Matched skills for intent",
        expect.objectContaining({ skillNames: expect.arrayContaining(["cesiumjs-camera"]) }),
      );
    });

    it("reports via logger.warn when no skill matches the intent", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const logger = fakeLogger();
      const noMatchIntent = "zzqxxblorptarglewhoopfrobnicate";

      await generateVerifiedCesiumCode({
        intent: noMatchIntent,
        model: fakeModel,
        logger,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "No skill matched intent; generating with no grounding context",
        expect.objectContaining({ intent: noMatchIntent }),
      );
    });

    it("reports each failed verification attempt's violations via logger.warn", async () => {
      generateTextMock.mockResolvedValue({ text: `fetch("https://evil.example.com");` });
      const logger = fakeLogger();

      await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        logger,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Generated code failed static verification",
        expect.objectContaining({
          attempt: 1,
          violationCount: expect.any(Number),
          violations: expect.arrayContaining([expect.stringMatching(/fetch/i)]),
        }),
      );
    });
  });

  describe("metrics", () => {
    function fakeMetrics() {
      return {
        recordTokenUsage: vi.fn(),
        recordSkillMatchScore: vi.fn(),
        recordGenerationDuration: vi.fn(),
      };
    }

    it("records the matched skill's BM25 score via recordSkillMatchScore", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent: "fly the camera to a new destination",
        model: fakeModel,
        metrics,
      });

      expect(metrics.recordSkillMatchScore).toHaveBeenCalledWith(expect.any(Number), {
        skill: "cesiumjs-camera",
        rank: 0,
        passedThreshold: true,
        score: expect.any(Number),
        includedInBestSkills: true,
      });
    });

    it("records every scored skill, including ones below the threshold", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent:
          "convert between Cartesian3 and Cartographic coordinates using Transforms and Ellipsoid",
        model: fakeModel,
        metrics,
      });

      const recordedSkills = metrics.recordSkillMatchScore.mock.calls.map(([, attrs]) => attrs);
      expect(recordedSkills.length).toBeGreaterThan(1);
    });

    it("threads a custom threshold through to matching and the recorded passedThreshold attribute", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent: "fly the camera to a new destination",
        model: fakeModel,
        metrics,
        threshold: 0,
      });

      const recordedSkills = metrics.recordSkillMatchScore.mock.calls.map(([, attrs]) => attrs);
      expect(recordedSkills.every((attrs) => attrs.passedThreshold === true)).toBe(true);
    });

    it("records token usage and generation duration per attempt", async () => {
      generateTextMock.mockResolvedValueOnce({
        text: `viewer.camera.flyTo({});`,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent: "fly the camera to a new destination",
        model: fakeModel,
        metrics,
      });

      expect(metrics.recordTokenUsage).toHaveBeenCalledWith(
        { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        { attempt: 1 },
      );
      expect(metrics.recordGenerationDuration).toHaveBeenCalledWith(expect.any(Number), {
        attempt: 1,
        outcome: "verified",
      });
    });

    it("records a 'rejected' outcome duration for a failed verification attempt", async () => {
      generateTextMock.mockResolvedValue({ text: `fetch("https://evil.example.com");` });
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        metrics,
      });

      expect(metrics.recordGenerationDuration).toHaveBeenCalledWith(expect.any(Number), {
        attempt: 1,
        outcome: "rejected",
      });
    });

    it("records a 'model_error' outcome duration when the model call throws", async () => {
      generateTextMock.mockRejectedValue(new Error("provider unavailable"));
      const metrics = fakeMetrics();

      await generateVerifiedCesiumCode({
        intent: "xyzzy plugh qux totally unrelated nonsense request",
        model: fakeModel,
        maxAttempts: 1,
        metrics,
      });

      expect(metrics.recordGenerationDuration).toHaveBeenCalledWith(expect.any(Number), {
        attempt: 1,
        outcome: "model_error",
      });
      expect(metrics.recordTokenUsage).not.toHaveBeenCalled();
    });

    it("never throws when usage is missing from the model result", async () => {
      generateTextMock.mockResolvedValueOnce({ text: `viewer.camera.flyTo({});` });
      const metrics = fakeMetrics();

      await expect(
        generateVerifiedCesiumCode({
          intent: "fly the camera to a new destination",
          model: fakeModel,
          metrics,
        }),
      ).resolves.toMatchObject({ verified: true });
      expect(metrics.recordTokenUsage).not.toHaveBeenCalled();
    });
  });
});
