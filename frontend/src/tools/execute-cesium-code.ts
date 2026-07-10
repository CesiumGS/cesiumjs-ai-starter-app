import { z } from "zod";
import type { Viewer } from "cesium";
import * as Cesium from "cesium";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";

/**
 * The `executeCesiumCode` tool's server-resolved output shape — this app's
 * backend `execute` (see `backend/src/tools/execute-cesium-code-tool.ts`)
 * always returns one of these two shapes, but the value arriving over the
 * wire is still untrusted (model/server-influenced) input from this client's
 * point of view, so it's validated before anything touches the live `Viewer`.
 */
export const executeCesiumCodeResultShape = z.union([
  z.object({ code: z.string() }),
  z.object({ error: z.string() }),
]);

export type ExecuteCesiumCodeResult = z.infer<typeof executeCesiumCodeResultShape>;

/** Returns `true` when `toolName` is this app's `executeCesiumCode` tool. */
export function isExecuteCesiumCodeTool(toolName: string): boolean {
  return toolName === CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode;
}

/**
 * Runs a server-generated, statically-verified CesiumJS snippet against the live `Viewer`. Only
 * runs after a human has approved the intent (the tool is `needsApproval`-gated); safety relies
 * on the backend's AST verification having already run, since there is no client-side sandbox.
 *
 * The snippet is wrapped in an async IIFE so top-level `await` (allowed by the AST verifier) works
 * inside the `new Function(...)` body, which is otherwise a plain non-async function.
 *
 * Returns an error message string on failure, or `null` on success.
 */
export async function executeApprovedCesiumCode(viewer: Viewer, code: string): Promise<string | null> {
  try {
    const executeCode = new Function("viewer", "Cesium", `return (async () => {\n${code}\n})();`);
    await executeCode(viewer, Cesium);
    return null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return `Code execution failed: ${errorMessage}`;
  }
}

/**
 * Validates a server-resolved `executeCesiumCode` tool result and, if it carries verified code,
 * runs it against the live `Viewer`. `output` is server-influenced but still untrusted client-side
 * input, so it's parsed against `executeCesiumCodeResultShape` before anything touches the Viewer.
 *
 * Returns an error message to surface to the user, or `null` when there is nothing to report.
 */
export async function handleExecuteCesiumCodeResult(
  viewer: Viewer | null,
  output: unknown,
): Promise<string | null> {
  const parsed = executeCesiumCodeResultShape.safeParse(output);
  if (!parsed.success) {
    return "Malformed executeCesiumCode result.";
  }
  if ("error" in parsed.data) {
    return null;
  }
  if (!viewer) {
    return "CesiumJS Viewer is not initialised";
  }

  return executeApprovedCesiumCode(viewer, parsed.data.code);
}
