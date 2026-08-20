/**
 * Minimal, configurable logging seam for the CZML codegen pipeline. Logging is entirely OFF by
 * default (`generateVerifiedCzml` falls back to {@link noopCodegenLogger}) so existing
 * callers/tests see no behavior change — a host application opts in by passing its own
 * {@link CodegenLogger} via `GenerateVerifiedCzmlOptions.logger`.
 */

/** A small, console-shaped logging interface so callers can plug in their own implementation. */
export interface CodegenLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** A {@link CodegenLogger} whose methods are all no-ops. Used whenever logging isn't configured. */
export const noopCodegenLogger: CodegenLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
