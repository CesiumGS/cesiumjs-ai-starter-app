/**
 * Minimal, configurable logging seam for the codegen sandbox. Logging is entirely OFF by default
 * (`runCesiumCodeInSandbox` falls back to {@link noopLogger}) so existing callers/tests see no
 * behavior change and no unsolicited console output — a host application opts in by passing its
 * own {@link SandboxLogger} (or one built with {@link createSandboxLogger}) via
 * `RunCesiumCodeOptions.logger`.
 */

/** Severity threshold for a {@link SandboxLogger}. `"silent"` disables every level. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/** A small, console-shaped logging interface so callers can plug in their own implementation. */
export interface SandboxLogger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** A {@link SandboxLogger} whose methods are all no-ops. Used whenever logging isn't configured. */
export const noopLogger: SandboxLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const LOG_PREFIX = "[codegen-sandbox]";

/**
 * Creates a `console`-backed {@link SandboxLogger} that only emits messages at or above `level`
 * (default `"warn"`). Every message is prefixed with `[codegen-sandbox]` so sandbox output is easy
 * to filter/grep out of a host application's own console logs.
 */
export function createConsoleLogger(level: LogLevel = "warn"): SandboxLogger {
  const threshold = LOG_LEVEL_SEVERITY[level];

  const bind =
    (methodLevel: Exclude<LogLevel, "silent">, consoleMethod: (...args: unknown[]) => void) =>
    (message: string, ...meta: unknown[]): void => {
      if (LOG_LEVEL_SEVERITY[methodLevel] < threshold) return;
      consoleMethod(`${LOG_PREFIX} ${message}`, ...meta);
    };

  return {
    debug: bind("debug", console.debug),
    info: bind("info", console.info),
    warn: bind("warn", console.warn),
    error: bind("error", console.error),
  };
}

/** Options for {@link createSandboxLogger}. */
export interface SandboxLoggerOptions {
  /** Set to `false` to fully disable logging (returns {@link noopLogger}). Defaults to `true`. */
  enabled?: boolean;
  /** Minimum level to emit when `enabled`. Defaults to `"warn"`. */
  level?: LogLevel;
}

/**
 * Convenience factory combining an enable/disable switch with a level threshold, so a host
 * application can configure sandbox logging with a single options object (e.g. from an env var)
 * instead of choosing between {@link noopLogger} and {@link createConsoleLogger} itself.
 */
export function createSandboxLogger(options: SandboxLoggerOptions = {}): SandboxLogger {
  const { enabled = true, level = "warn" } = options;
  return enabled ? createConsoleLogger(level) : noopLogger;
}
