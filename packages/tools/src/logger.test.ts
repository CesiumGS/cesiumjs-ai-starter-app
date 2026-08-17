import { describe, expect, test, vi } from "vitest";
import { createConsoleToolsLogger, noopToolsLogger } from "./logger.js";

describe("noopToolsLogger", () => {
  test("every method is a no-op", () => {
    expect(() => {
      noopToolsLogger.debug("debug");
      noopToolsLogger.info("info");
      noopToolsLogger.warn("warn");
      noopToolsLogger.error("error");
    }).not.toThrow();
  });
});

describe("createConsoleToolsLogger", () => {
  test("defaults to 'warn': suppresses debug/info, emits warn/error", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createConsoleToolsLogger();
    logger.debug("a debug message");
    logger.info("an info message");
    logger.warn("a warn message");
    logger.error("an error message");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[cesium-tools] a warn message", "");
    expect(error).toHaveBeenCalledWith("[cesium-tools] an error message", "");

    debug.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  test("'debug' level emits every method", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    createConsoleToolsLogger("debug").debug("a debug message");

    expect(debug).toHaveBeenCalledWith("[cesium-tools] a debug message", "");
    debug.mockRestore();
  });

  test("'silent' returns noopToolsLogger, suppressing every level", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    createConsoleToolsLogger("silent").error("an error message");

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
