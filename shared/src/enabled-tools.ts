import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import {
  CODEGEN_CESIUM_TOOL_NAMES,
  type CodegenCesiumToolName,
} from "@cesium-ai/codegen-cesium/names";
import { CODEGEN_CZML_TOOL_NAMES, type CodegenCzmlToolName } from "@cesium-ai/codegen-czml/names";

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
 * `@cesium-ai/tools-schemas`'s viewer tools, `@cesium-ai/codegen-cesium`'s
 * codegen-backed `executeCesiumCode` tool, and `@cesium-ai/codegen-czml`'s
 * codegen-backed `generateCzml` tool), so no tool definitions (descriptions,
 * Zod schemas) leak into the client bundle.
 *
 * `satisfies` keeps each entry checked against the combined
 * {@link CesiumToolName} | {@link CodegenCesiumToolName} | {@link CodegenCzmlToolName}
 * union (a typo fails to compile) while preserving the literal element types.
 */
export const ENABLED_CESIUM_TOOLS = [
  // all viewer tools from the schema catalogue
  ...(Object.values(CESIUM_TOOL_NAMES) as CesiumToolName[]),
  // codegen (server-executed, arbitrary CesiumJS code against the live Viewer)
  CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode,
  // codegen (server-executed, intent -> verified CZML loaded into the live Viewer)
  CODEGEN_CZML_TOOL_NAMES.generateCzml,
] as const satisfies readonly (CesiumToolName | CodegenCesiumToolName | CodegenCzmlToolName)[];

/** Union of the tool names this app has enabled. */
export type EnabledCesiumTool = (typeof ENABLED_CESIUM_TOOLS)[number];
