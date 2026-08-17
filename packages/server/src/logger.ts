/**
 * Minimal, configurable logging seam for this package's routers. Logging is entirely OFF by
 * default (`createChatRouter`/`createMcpAppRouter` fall back to {@link noopServerLogger}) so
 * existing callers/tests see no behavior change — a host application opts in by passing its own
 * {@link ServerLogger} (e.g. one backed by its own OTEL-wired logger).
 */

/** A small, console-shaped logging interface so callers can plug in their own implementation. */
export interface ServerLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** A {@link ServerLogger} whose methods are all no-ops. Used whenever logging isn't configured. */
export const noopServerLogger: ServerLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
