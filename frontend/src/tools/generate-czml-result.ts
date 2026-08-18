import { z } from "zod";
import { CODEGEN_CZML_TOOL_NAMES } from "@cesium-ai/codegen-czml/names";

/**
 * The `generateCzml` tool's server-resolved output shape — this app's backend `execute` (see
 * `backend/src/tools/generate-czml-tool.ts`) always returns one of these two shapes, but the
 * value arriving over the wire is still untrusted (model/server-influenced) input from this
 * client's point of view, so it's validated before anything touches the live `Viewer`.
 */
export const generateCzmlResultShape = z.union([
  z.object({ czml: z.array(z.record(z.string(), z.unknown())), description: z.string() }),
  z.object({ error: z.string() }),
]);

export type GenerateCzmlResult = z.infer<typeof generateCzmlResultShape>;

/** Returns `true` when `toolName` is this app's `generateCzml` tool. */
export function isGenerateCzmlTool(toolName: string): boolean {
  return toolName === CODEGEN_CZML_TOOL_NAMES.generateCzml;
}
