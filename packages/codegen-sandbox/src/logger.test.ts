import { afterEach, describe, expect, test, vi } from "vitest";
import { createConsoleLogger, createSandboxLogger, noopLogger } from "./logger.js";

describe("noopLogger", () => {
  test("every method is a no-op and never throws", () => {
    expect(() => {
      noopLogger.debug("debug");
      noopLogger.info("info");
      noopLogger.warn("warn");
      noopLogger.error("error");
    }).not.toThrow();
  });
});

describe("createConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("defaults to the \"warn\" level, suppressing debug/info but emitting warn/error", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createConsoleLogger();
    logger.debug("a debug message");
    logger.info("an info message");
    logger.warn("a warn message");
    logger.error("an error message");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[codegen-sandbox] a warn message");
    expect(error).toHaveBeenCalledWith("[codegen-sandbox] an error message");
  });

  test("\"debug\" level emits every method", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createConsoleLogger("debug");
    logger.debug("a debug message");
    logger.info("an info message");
    logger.warn("a warn message");
    logger.error("an error message");

    expect(debug).toHaveBeenCalledWith("[codegen-sandbox] a debug message");
    expect(info).toHaveBeenCalledWith("[codegen-sandbox] an info message");
    expect(warn).toHaveBeenCalledWith("[codegen-sandbox] a warn message");
    expect(error).toHaveBeenCalledWith("[codegen-sandbox] an error message");
  });

  test("\"silent\" level suppresses every method, including error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createConsoleLogger("silent");
    logger.error("an error message");

    expect(error).not.toHaveBeenCalled();
  });

  test("passes through extra metadata arguments unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const meta = { handleId: "h1" };

    createConsoleLogger("warn").warn("a message", meta);

    expect(warn).toHaveBeenCalledWith("[codegen-sandbox] a message", meta);
  });
});

describe("createSandboxLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns noopLogger when enabled is false", () => {
    expect(createSandboxLogger({ enabled: false })).toBe(noopLogger);
  });

  test("defaults to enabled with a \"warn\" threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    const logger = createSandboxLogger();
    logger.debug("suppressed");
    logger.warn("emitted");

    expect(debug).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[codegen-sandbox] emitted");
  });

  test("honors an explicit level when enabled", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    const logger = createSandboxLogger({ level: "debug" });
    logger.debug("emitted");

    expect(debug).toHaveBeenCalledWith("[codegen-sandbox] emitted");
  });
});
