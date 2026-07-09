import type { ToolSet } from "ai";
import { createFlyTo, flyTo, type FlyToConfig } from "./tools/flyTo/flyTo.js";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "./tool-names.js";

export { createFlyTo, flyTo, type FlyToConfig };
export {
  DEFAULT_FLY_TO_DESCRIPTION,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
  buildFlyToInputSchema,
  defaultFlyToInputSchema,
  type FlyToFieldDescriptions,
} from "./tools/flyTo/flyTo.js";
export { CESIUM_TOOL_NAMES, type CesiumToolName } from "./tool-names.js";
export { flyToInputShape, type FlyToInput } from "./schemas.js";
export { buildDescribedSchema, describeShape } from "./lib/describe-shape.js";
export { mergeDescriptions } from "./lib/merge-descriptions.js";

/**
 * Per-tool configuration for {@link createCesiumTools}. Each key maps to a
 * tool's {@link FlyToConfig}-style overrides; pass `false` to omit a tool from
 * the registry entirely.
 */
export interface CesiumToolsConfig {
  /**
   * Opt-in allowlist of tool names to build. When provided, **only** these
   * tools are registered — the natural way for a host to declare the subset it
   * wants as the Cesium tool catalogue grows. Omit to include every tool by
   * default. A tool named here is still dropped if its per-tool config is
   * `false`, so the allowlist and per-tool overrides compose.
   */
  enabled?: readonly CesiumToolName[];
  /** Override `flyTo`'s description / input schema, or `false` to exclude it. */
  flyTo?: FlyToConfig | false;
}

/**
 * Builds the set of CesiumJS viewer tools (client-side execution). Returning a
 * factory keeps the registry composable — future tool groups (MCP-backed,
 * server-side, etc.) can be spread alongside it:
 *
 *   const tools = { ...createCesiumTools(), ...createMcpTools() };
 *
 * Pass {@link CesiumToolsConfig} to customize a tool's description or input
 * schema per host application, e.g.:
 *
 *   createCesiumTools({
 *     flyTo: { description: "Move the camera to a place." },
 *   });
 *
 * Pass {@link CesiumToolsConfig.enabled} to register only a chosen subset —
 * the host's allowlist as the catalogue grows:
 *
 *   createCesiumTools({ enabled: ["flyTo"] });
 *
 * These tools are **schemas only** — none define `execute`. The host
 * application runs each tool call against its live CesiumJS `Viewer` and posts
 * the result back to the agent loop (see `@cesium-ai/server`).
 */
export function createCesiumTools(config: CesiumToolsConfig = {}): ToolSet {
  const tools: ToolSet = {};

  // A tool ships only when the allowlist admits it (or there is no allowlist).
  const allowed = (name: CesiumToolName): boolean =>
    config.enabled === undefined || config.enabled.includes(name);

  // Key the registry off the shared name constant — never a bare string — so a
  // tool's server name stays in lockstep with the client executor that handles
  // it (see `./tool-names.ts`).
  if (config.flyTo !== false && allowed(CESIUM_TOOL_NAMES.flyTo)) {
    tools[CESIUM_TOOL_NAMES.flyTo] = createFlyTo(config.flyTo);
  }

  return tools;
}
