import type { Viewer } from "cesium";
import type { CesiumToolName } from "@cesium-ai/tools-schemas/names";

/**
 * The structured result every executor resolves: `success` plus an optional
 * `error` message, and any extra output data a tool wants to surface back to
 * the model (e.g. `entityList`'s `entities`, `cameraGetPosition`'s
 * coordinates). Kept intentionally loose (an index signature) rather than a
 * discriminated union per tool, since this one type is shared by all 32 tools
 * in the catalogue and the model only ever needs to see plain JSON back.
 */
export interface ToolExecutionResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * A client-side executor: validates `rawArgs` (untrusted, model-produced
 * input) and runs the corresponding action against the live `Viewer`. Every
 * export in this package has this exact shape, so a host can freely mix
 * defaults and overrides in one `Record<CesiumToolName, ToolExecutor>`.
 */
export type ToolExecutor = (viewer: Viewer, rawArgs: unknown) => Promise<ToolExecutionResult>;

/**
 * A full registry of executors, one per {@link CesiumToolName}. This is the
 * shape both {@link DEFAULT_CESIUM_TOOL_EXECUTORS} and
 * {@link createCesiumToolExecutors}'s return value have — `Record` (not
 * `Partial`) so a typo or a missing tool fails to compile, mirroring how this
 * app's own `ChatPanel.tsx` already types its `TOOL_EXECUTORS` map.
 */
export type CesiumToolExecutors = Record<CesiumToolName, ToolExecutor>;

/**
 * Per-tool overrides accepted by `createCesiumToolExecutors`. Provide a
 * replacement executor for any tool name to change or extend its behavior
 * (e.g. validate against an app-extended args shape) without forking the rest
 * of the registry.
 */
export type CesiumToolExecutorOverrides = Partial<CesiumToolExecutors>;
