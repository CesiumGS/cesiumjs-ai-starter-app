import type { Viewer } from "cesium";
import { z } from "zod";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import { toolInputJsonSchema } from "@cesium-ai/tools-schemas/json-schema";
import {
  createCesiumToolExecutors,
  type CesiumToolExecutorOverrides,
  type CesiumToolExecutors,
} from "@cesium-ai/tools";
import {
  CESIUM_WEBMCP_TOOL_DEFINITIONS,
  READ_ONLY_CESIUM_WEBMCP_TOOLS,
} from "./tool-definitions.js";
import { noopWebMcpToolsLogger, type WebMcpToolsLogger } from "./logger.js";
import type { WebMcpModelContext, WebMcpTool } from "./webmcp-types.js";

/** Per-tool override for {@link registerCesiumWebMcpTools} / {@link buildCesiumWebMcpTools}. */
export interface CesiumWebMcpToolConfig {
  /** Override the model-facing description. Defaults to the tool's `@cesium-ai/tools-schemas` description. */
  description?: string;
  /** Fully replace the input schema (a Zod schema — converted to JSON Schema for WebMCP). */
  inputSchema?: z.ZodTypeAny;
}

/** Per-tool config, keyed by {@link CesiumToolName}. Pass `false` to omit a tool entirely. */
export type CesiumWebMcpToolConfigs = Partial<
  Record<CesiumToolName, CesiumWebMcpToolConfig | false>
>;

export interface RegisterCesiumWebMcpToolsOptions {
  /**
   * Opt-in allowlist of tool names to register. When provided, **only** these tools are
   * registered. Omit to register every tool in `@cesium-ai/tools-schemas`'s catalogue.
   */
  enabled?: readonly CesiumToolName[];
  /** Per-tool executor overrides, passed straight through to `@cesium-ai/tools`'s `createCesiumToolExecutors`. */
  executors?: CesiumToolExecutorOverrides;
  /** Per-tool description/schema overrides, or `false` to exclude a tool. */
  toolConfig?: CesiumWebMcpToolConfigs;
  logger?: WebMcpToolsLogger;
  /** Defaults to the global `document` — override for tests or non-default documents/iframes. */
  document?: Document;
  /**
   * Checked before each individual tool's `registerTool` call; if already aborted, registration
   * stops immediately instead of finishing the rest of the batch. Lets a caller bail out of an
   * in-flight registration the instant it's known to be stale (e.g. a superseded React
   * StrictMode double-invoke) rather than racing an overlapping registration for the same tool
   * names.
   */
  cancelSignal?: AbortSignal;
}

export interface RegisteredCesiumWebMcpTools {
  /** Names of every tool actually registered (empty when WebMCP isn't supported). */
  toolNames: string[];
  /** Unregisters every tool this call registered. Safe to call multiple times. */
  unregister: () => void;
}

/** Returns `document.modelContext` if the browser implements WebMCP, `undefined` otherwise. */
function getModelContext(doc: Document): WebMcpModelContext | undefined {
  return doc.modelContext;
}

/**
 * Feature-detects WebMCP support (https://developer.chrome.com/docs/ai/webmcp) in the given
 * document. `document.modelContext` only exists in browsers that implement the proposal (Chrome,
 * behind `chrome://flags/#enable-webmcp-testing` or the origin trial, as of 2026).
 */
export function isWebMcpSupported(doc: Document = document): boolean {
  return typeof doc !== "undefined" && Boolean(getModelContext(doc));
}

/**
 * Builds the WebMCP tool payloads (name/description/inputSchema/execute) for every enabled Cesium
 * viewer tool, without registering them on `document.modelContext`. Exposed separately from
 * {@link registerCesiumWebMcpTools} so a host can inspect or manually register the payloads (e.g.
 * in a unit test, or to call `registerTool` itself with extra options this helper doesn't expose).
 */
export function buildCesiumWebMcpTools(
  viewer: Viewer,
  options: RegisterCesiumWebMcpToolsOptions = {},
): WebMcpTool[] {
  const executors: CesiumToolExecutors = createCesiumToolExecutors(options.executors);
  const enabledNames = new Set<CesiumToolName>(
    options.enabled ?? (Object.values(CESIUM_TOOL_NAMES) as CesiumToolName[]),
  );

  return (Object.values(CESIUM_TOOL_NAMES) as CesiumToolName[])
    .filter((name) => enabledNames.has(name))
    .filter((name) => options.toolConfig?.[name] !== false)
    .map((name) => {
      const definition = CESIUM_WEBMCP_TOOL_DEFINITIONS[name];
      const override = options.toolConfig?.[name] as CesiumWebMcpToolConfig | undefined;
      const executor = executors[name];

      return {
        name,
        description: override?.description ?? definition.description,
        inputSchema: toolInputJsonSchema(override?.inputSchema ?? definition.inputSchema),
        annotations: { readOnlyHint: READ_ONLY_CESIUM_WEBMCP_TOOLS.has(name) },
        // WebMCP's execute() result is handed back to the calling agent as-is; JSON-stringify the
        // structured { success, error?, ... } result the same way every Cesium tool call resolves.
        execute: async (rawArgs: Record<string, unknown>) => {
          const result = await executor(viewer, rawArgs);
          return JSON.stringify(result);
        },
      } satisfies WebMcpTool;
    });
}

/**
 * Registers every enabled tool from `@cesium-ai/tools-schemas`'s catalogue on
 * `document.modelContext` (the WebMCP Imperative API), backed by `@cesium-ai/tools`'s executors
 * running against the live `viewer`. This is what lets an in-browser agent (Chrome's built-in AI,
 * or the Model Context Tool Inspector extension) discover and call Cesium viewer tools directly on
 * this page — see this package's README for how that differs from a standard MCP server.
 *
 * No-ops (and logs a warning) when the current browser/document doesn't support WebMCP, so it's
 * always safe to call this unconditionally during app startup.
 */
export async function registerCesiumWebMcpTools(
  viewer: Viewer,
  options: RegisterCesiumWebMcpToolsOptions = {},
): Promise<RegisteredCesiumWebMcpTools> {
  const logger = options.logger ?? noopWebMcpToolsLogger;
  const doc = options.document ?? document;
  const modelContext = getModelContext(doc);

  if (!modelContext) {
    logger.warn(
      "WebMCP (document.modelContext) is not available — no Cesium tools were registered. " +
        "Enable chrome://flags/#enable-webmcp-testing (or join the origin trial) to test this. " +
        "See https://developer.chrome.com/docs/ai/webmcp.",
    );
    return { toolNames: [], unregister: () => {} };
  }

  const tools = buildCesiumWebMcpTools(viewer, options);
  const controller = new AbortController();
  const attemptedNames: string[] = [];

  // Unregister already-registered tools the instant a superseded mount is cancelled, rather than
  // waiting for this function's promise to resolve and the caller to react in a `.then()` — that
  // gap let a fresh mount's registration for the same tool name race in before the stale mount's
  // tool was actually removed (surfaced as a "Duplicate tool name" error under React StrictMode).
  options.cancelSignal?.addEventListener("abort", () => controller.abort());

  for (const tool of tools) {
    if (options.cancelSignal?.aborted) break;
    attemptedNames.push(tool.name);
    try {
      await modelContext.registerTool(tool, { signal: controller.signal });
      logger.debug("Registered WebMCP tool", { name: tool.name });
    } catch (error) {
      logger.error("Failed to register WebMCP tool", {
        name: tool.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Registered Cesium WebMCP tools", { count: attemptedNames.length });

  return {
    toolNames: attemptedNames,
    unregister: () => controller.abort(),
  };
}
