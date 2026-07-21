import type { Viewer } from "cesium";
import { createConsoleLogger, runCesiumCodeInSandbox } from "@cesium-ai/codegen-sandbox";
import { config } from "../utils/config";
import { executeCesiumCodeResultShape } from "./execute-cesium-code-result";
import { createRenderErrorWatch, DEFAULT_RENDER_ERROR_WATCH_MS } from "./render-error-watch";

export {
  executeCesiumCodeResultShape,
  isExecuteCesiumCodeTool,
  type ExecuteCesiumCodeResult,
} from "./execute-cesium-code-result";
export { waitForRenderError } from "./render-error-watch";

/**
 * Console-backed sandbox logger, level configured via `config.logLevel` (env `VITE_LOG_LEVEL`,
 * defaults to `debug` in dev / `silent` in production builds — see `utils/config.ts`). Shared
 * across every `executeApprovedCesiumCode` call rather than created per-call since it's stateless
 * and its level never changes at runtime.
 */
const sandboxLogger = createConsoleLogger(config.logLevel);

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
  const renderErrorWatch = createRenderErrorWatch(viewer, DEFAULT_RENDER_ERROR_WATCH_MS);
  const outcome = await runCesiumCodeInSandbox({ viewer, code, logger: sandboxLogger });
  renderErrorWatch.finishExecution();
  const renderError = await renderErrorWatch.result;

  if (!outcome.success) {
    const executionError = `Code execution failed: ${outcome.error ?? "Unknown sandbox error"}`;
    return renderError
      ? `${executionError}; partial scene changes also caused a rendering error: ${renderError}`
      : executionError;
  }

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
