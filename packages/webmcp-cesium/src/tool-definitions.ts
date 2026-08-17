import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import { CESIUM_TOOL_DEFINITIONS, type CesiumToolDefinition } from "@cesium-ai/tools-schemas";

/** A tool's model-facing description plus its structural Zod input schema. */
export type CesiumWebMcpToolDefinition = CesiumToolDefinition;

/**
 * `@cesium-ai/tools-schemas`'s canonical per-tool description/schema registry, reused directly
 * instead of re-declaring a `CesiumToolName -> {description, inputSchema}` mapping here.
 */
export const CESIUM_WEBMCP_TOOL_DEFINITIONS: Record<CesiumToolName, CesiumWebMcpToolDefinition> =
  CESIUM_TOOL_DEFINITIONS;

/** Tools that only read Viewer state and never mutate it — surfaced as `annotations.readOnlyHint`. */
export const READ_ONLY_CESIUM_WEBMCP_TOOLS: ReadonlySet<CesiumToolName> = new Set([
  CESIUM_TOOL_NAMES.entityList,
  CESIUM_TOOL_NAMES.cameraGetPosition,
  CESIUM_TOOL_NAMES.animationListActive,
  CESIUM_TOOL_NAMES.imageryList,
]);
