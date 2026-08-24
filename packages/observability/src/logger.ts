/** Framework-neutral severity threshold. `"silent"` disables every level. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/** Minimal structured logger accepted by server-side Cesium AI packages. */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Logger used when a host application does not configure logging. */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const LEVEL_ORDER: Record<Exclude<LogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface ConsoleLoggerOptions {
  /** Prefix written as `[scope]` before every message. */
  scope: string;
  /** Minimum level to emit. Defaults to `"info"`; `"silent"` returns {@link noopLogger}. */
  level?: LogLevel;
}

/** Creates a scope-prefixed, level-filtered logger backed by the global console. */
export function createConsoleLogger({ scope, level = "info" }: ConsoleLoggerOptions): Logger {
  if (level === "silent") return noopLogger;

  const enabled = (candidate: Exclude<LogLevel, "silent">): boolean =>
    LEVEL_ORDER[candidate] >= LEVEL_ORDER[level];
  const emit = (
    candidate: Exclude<LogLevel, "silent">,
    consoleMethod: (...args: unknown[]) => void,
    message: string,
    meta?: Record<string, unknown>,
  ): void => {
    if (!enabled(candidate)) return;
    const prefixedMessage = `[${scope}] ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      consoleMethod(prefixedMessage, meta);
    } else {
      consoleMethod(prefixedMessage);
    }
  };

  return {
    debug: (message, meta) => emit("debug", console.debug, message, meta),
    info: (message, meta) => emit("info", console.info, message, meta),
    warn: (message, meta) => emit("warn", console.warn, message, meta),
    error: (message, meta) => emit("error", console.error, message, meta),
  };
}
