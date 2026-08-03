import type { ToolExecutionResult } from "../types.js";

/** Builds a successful {@link ToolExecutionResult}, optionally carrying output data. */
export function ok(data: Record<string, unknown> = {}): ToolExecutionResult {
  return { success: true, ...data };
}

/** Builds a failed {@link ToolExecutionResult} with the given message. */
export function fail(error: string): ToolExecutionResult {
  return { success: false, error };
}
