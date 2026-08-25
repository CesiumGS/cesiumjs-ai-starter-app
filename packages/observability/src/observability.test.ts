import { describe, expect, it, vi } from "vitest";
import { createConsoleLogger, noopCodegenMetrics, noopLogger, noopServerMetrics } from "./index.js";

describe("observability no-op defaults", () => {
  it("accepts logger calls without throwing", () => {
    expect(() => {
      noopLogger.debug("debug");
      noopLogger.info("info", { scope: "test" });
      noopLogger.warn("warn");
      noopLogger.error("error", { error: new Error("test") });
    }).not.toThrow();
  });

  it("accepts codegen metrics calls without throwing", () => {
    expect(() => {
      noopCodegenMetrics.recordTokenUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
      noopCodegenMetrics.recordSkillMatchScore(1.5);
      noopCodegenMetrics.recordGenerationDuration(100);
    }).not.toThrow();
  });

  it("accepts server metrics calls without throwing", () => {
    expect(() => {
      noopServerMetrics.recordTokenUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
      noopServerMetrics.recordRequestDuration(100);
      noopServerMetrics.recordToolApproval("flyTo", true);
    }).not.toThrow();
  });
});

describe("createConsoleLogger", () => {
  it("prefixes messages, filters by level, and forwards structured metadata", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createConsoleLogger({ scope: "test-scope", level: "warn" });

    logger.debug("hidden");
    logger.warn("visible", { attempt: 2 });

    expect(debug).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[test-scope] visible", { attempt: 2 });

    debug.mockRestore();
    warn.mockRestore();
  });

  it("returns the canonical no-op logger when silent", () => {
    expect(createConsoleLogger({ scope: "test", level: "silent" })).toBe(noopLogger);
  });
});
