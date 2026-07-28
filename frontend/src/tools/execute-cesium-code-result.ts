import { z } from "zod";
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
