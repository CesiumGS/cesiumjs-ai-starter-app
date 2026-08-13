import { describe, expect, test } from "vitest";
import { noopServerMetrics } from "./metrics.js";

describe("noopServerMetrics", () => {
  test("every method is a no-op", () => {
    expect(() => {
      noopServerMetrics.recordTokenUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
      noopServerMetrics.recordRequestDuration(100);
      noopServerMetrics.recordToolApproval("executeCesiumCode", true);
    }).not.toThrow();
  });
});
