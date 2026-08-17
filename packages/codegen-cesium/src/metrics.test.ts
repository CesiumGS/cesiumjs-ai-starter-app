import { describe, expect, test } from "vitest";
import { noopCodegenMetrics } from "./metrics.js";

describe("noopCodegenMetrics", () => {
  test("every method is a no-op", () => {
    expect(() => {
      noopCodegenMetrics.recordTokenUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
      noopCodegenMetrics.recordSkillMatchScore(1.5);
      noopCodegenMetrics.recordGenerationDuration(100);
    }).not.toThrow();
  });
});
