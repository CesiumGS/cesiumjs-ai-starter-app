/** Minimal leveled logger interface, so this package has no logging-framework dependency. */
export interface McpToolsLogger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export type McpToolsLogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<Exclude<McpToolsLogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Default logger: does nothing. Used when `createMcpTools` is called with no `logger` option. */
export const noopMcpToolsLogger: McpToolsLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Console-backed logger, prefixed `[mcp-tools]`. Pass `level` to filter — e.g.
 * `"warn"` only surfaces connection failures and blocked/timed-out tool
 * calls, `"debug"` also logs every discovered tool's name + description
 * (useful for spotting MCP tool-poisoning / silent description changes).
 */
export function createConsoleMcpToolsLogger(level: McpToolsLogLevel = "info"): McpToolsLogger {
  if (level === "silent") return noopMcpToolsLogger;
  const enabled = (l: Exclude<McpToolsLogLevel, "silent">) => LEVEL_ORDER[l] >= LEVEL_ORDER[level];
  const format = (message: string) => `[mcp-tools] ${message}`;
  return {
    debug: (message, meta) => enabled("debug") && console.debug(format(message), meta ?? ""),
    info: (message, meta) => enabled("info") && console.info(format(message), meta ?? ""),
    warn: (message, meta) => enabled("warn") && console.warn(format(message), meta ?? ""),
    error: (message, meta) => enabled("error") && console.error(format(message), meta ?? ""),
  };
}
