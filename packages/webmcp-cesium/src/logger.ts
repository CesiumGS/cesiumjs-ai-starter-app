/** Minimal leveled logger interface, so this package has no logging-framework dependency. */
export interface WebMcpToolsLogger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export type WebMcpToolsLogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<Exclude<WebMcpToolsLogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Default logger: does nothing. Used when `registerCesiumWebMcpTools` is called with no `logger` option. */
export const noopWebMcpToolsLogger: WebMcpToolsLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Console-backed logger, prefixed `[webmcp-cesium]`. Pass `level` to filter — e.g. `"warn"` only
 * surfaces registration failures and unsupported-browser warnings, `"debug"` also logs every
 * registered tool's name.
 */
export function createConsoleWebMcpToolsLogger(
  level: WebMcpToolsLogLevel = "info",
): WebMcpToolsLogger {
  if (level === "silent") return noopWebMcpToolsLogger;
  const enabled = (l: Exclude<WebMcpToolsLogLevel, "silent">) =>
    LEVEL_ORDER[l] >= LEVEL_ORDER[level];
  const format = (message: string) => `[webmcp-cesium] ${message}`;
  return {
    debug: (message, meta) => enabled("debug") && console.debug(format(message), meta ?? ""),
    info: (message, meta) => enabled("info") && console.info(format(message), meta ?? ""),
    warn: (message, meta) => enabled("warn") && console.warn(format(message), meta ?? ""),
    error: (message, meta) => enabled("error") && console.error(format(message), meta ?? ""),
  };
}
