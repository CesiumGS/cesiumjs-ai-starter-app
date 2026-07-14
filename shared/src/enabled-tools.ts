import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import {
  CODEGEN_CESIUM_TOOL_NAMES,
  type CodegenCesiumToolName,
} from "@cesium-ai/codegen-cesium/names";

/**
 * The CesiumJS tools **this sample app** turns on — the single source of truth
 * for the app's tool selection, shared by both sides:
 *
 * - the **backend** builds its tool registry from this list
 *   (`createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })`, plus its own
 *   `executeCesiumCode` tool gated on this same list — see `backend/src/app.ts`),
 *   so the model is only ever offered these tools; and
 * - the **frontend** keys its executor handling off it, so it acts on a tool
 *   call only when this app actually enabled that tool.
 *
 * As the Cesium tool catalogue grows, a host curates its surface by editing
 * this one array — add a name to expose a tool, remove it to retire it, and
 * both sides follow. We import only the schema-free `/names` subpaths (from
 * both `@cesium-ai/tools-cesium`, viewer tools, and `@cesium-ai/codegen-cesium`,
 * the codegen-backed `executeCesiumCode` tool), so no tool definitions
 * (descriptions, Zod schemas) leak into the client bundle.
 *
 * `satisfies` keeps each entry checked against the combined
 * {@link CesiumToolName} | {@link CodegenCesiumToolName} union (a typo fails
 * to compile) while preserving the literal element types.
 */
export const ENABLED_CESIUM_TOOLS = [
  CESIUM_TOOL_NAMES.flyTo,
  CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode,
] as const satisfies readonly (CesiumToolName | CodegenCesiumToolName)[];

/** Union of the tool names this app has enabled. */
export type EnabledCesiumTool = (typeof ENABLED_CESIUM_TOOLS)[number];
