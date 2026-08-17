/**
 * Minimal, configurable logging seam for this package's executors. Logging is entirely OFF by
 * default (`createCesiumToolExecutors` returns unwrapped executors when no `logger` is passed) so
 * existing callers/tests see no behavior change — a host opts in by passing its own
 * {@link ToolsLogger} (e.g. one backed by its own OTEL-wired logger, or {@link createConsoleToolsLogger}).
 */

/** A small, console-shaped logging interface so callers can plug in their own implementation. */
export interface ToolsLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type ToolsLogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<Exclude<ToolsLogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** A {@link ToolsLogger} whose methods are all no-ops. Used whenever logging isn't configured. */
export const noopToolsLogger: ToolsLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Console-backed logger, prefixed `[cesium-tools]`. Pass `level` to filter — e.g. `"warn"` only
 * surfaces failed/thrown tool calls, `"debug"` also logs every successful call.
 */
export function createConsoleToolsLogger(level: ToolsLogLevel = "warn"): ToolsLogger {
  if (level === "silent") return noopToolsLogger;
  const enabled = (l: Exclude<ToolsLogLevel, "silent">) => LEVEL_ORDER[l] >= LEVEL_ORDER[level];
  const format = (message: string) => `[cesium-tools] ${message}`;
  return {
    debug: (message, meta) => enabled("debug") && console.debug(format(message), meta ?? ""),
    info: (message, meta) => enabled("info") && console.info(format(message), meta ?? ""),
    warn: (message, meta) => enabled("warn") && console.warn(format(message), meta ?? ""),
    error: (message, meta) => enabled("error") && console.error(format(message), meta ?? ""),
  };
}
