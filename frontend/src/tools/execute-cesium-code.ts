import { z } from "zod";
import type { Viewer } from "cesium";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { runCesiumCodeInSandbox } from "@cesium-ai/sandbox-cesium";

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
 * How long to keep watching `viewer.scene.renderError` after a sandboxed snippet returns
 * successfully before declaring the call error-free. Bounded rather than indefinite: a runtime
 * render crash (bad style expression, invalid shader, ...) from newly-added content typically
 * surfaces within the first few render frames, but the listener can't be kept alive forever
 * without risking misattributing a later, unrelated crash to this call.
 */
const DEFAULT_RENDER_ERROR_WATCH_MS = 1500;

/**
 * Watches `viewer.scene.renderError` for a bounded window and resolves with the error message if
 * one fires, or `undefined` if the window elapses cleanly.
 *
 * This exists because a runtime crash from generated code doesn't necessarily happen inside the
 * sandboxed call itself: code that passes GATE 1 (static AST verification) and runs successfully
 * can still make Cesium throw *later*, on the next `requestAnimationFrame` render tick, once it
 * actually tries to render whatever was just added (e.g. `Model.applyStyle` evaluating a style
 * expression against real feature metadata, or a shader failing to compile) — a plain try/catch
 * around the sandboxed call can never observe this, since by the time it throws, that call has
 * already returned. `Scene.renderError` is the one Cesium API that does surface it.
 *
 * Cesium's own default behavior on any render error is to permanently stop the render loop
 * (`viewer.useDefaultRenderLoop` flips to `false`, freezing the view) and — unless
 * `showRenderLoopErrors: false` was passed to the `Viewer` (see `cesium-loader.ts`) — show a
 * blocking HTML panel. This resumes the render loop itself once the error is captured, so a bad
 * AI-generated snippet degrades to a reported error instead of a frozen view.
 */
export function waitForRenderError(
  viewer: Viewer,
  timeoutMs = DEFAULT_RENDER_ERROR_WATCH_MS,
): Promise<string | undefined> {
  const renderError = viewer.scene?.renderError;
  if (!renderError || typeof renderError.addEventListener !== "function") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    let settled = false;

    const removeListener = renderError.addEventListener((_scene: unknown, error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeListener();
      // Cesium's own render loop stops itself on any renderError — resume it so the view doesn't
      // stay permanently frozen because of one bad generated snippet.
      viewer.useDefaultRenderLoop = true;
      resolve(error instanceof Error ? error.message : String(error));
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      removeListener();
      resolve(undefined);
    }, timeoutMs);
  });
}

/**
 * Runs a server-generated, statically-verified CesiumJS snippet in a fresh QuickJS-WASM sandbox
 * bound to the live `Viewer`. Only runs after a human has approved the intent (the tool is
 * `needsApproval`-gated). The sandbox provides an independent runtime boundary and resource
 * limits; server-side AST verification remains a separate defense-in-depth gate. After a
 * successful run, also watches for a delayed render-loop crash (see {@link waitForRenderError}).
 *
 * Returns an error message string on failure, or `null` on success.
 */
export async function executeApprovedCesiumCode(
  viewer: Viewer,
  code: string,
): Promise<string | null> {
  const outcome = await runCesiumCodeInSandbox({ viewer, code });
  if (!outcome.success) {
    return `Code execution failed: ${outcome.error ?? "Unknown sandbox error"}`;
  }

  const renderError = await waitForRenderError(viewer);
  return renderError ? `Code executed but caused a rendering error: ${renderError}` : null;
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
  beforeExecute?: () => void,
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

  try {
    beforeExecute?.();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return `Code execution failed: ${errorMessage}`;
  }

  return executeApprovedCesiumCode(viewer, parsed.data.code);
}
