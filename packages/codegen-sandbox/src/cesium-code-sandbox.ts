/**
 * QuickJS-wasm sandbox that executes LLM-generated code directly against a real, bound CesiumJS
 * API surface (see `cesium-bindings.ts`), instead of a fixed set of pre-implemented capability
 * functions. The frontend's role here is purely mechanical: create an isolated interpreter, bind
 * the allowed real symbols, marshal calls across the boundary, and enforce resource limits — it
 * never decides what CesiumJS calls a given user intent should produce.
 */
import { newAsyncContext, shouldInterruptAfterDeadline } from "quickjs-emscripten";
import type { Viewer } from "cesium";
import type { SceneCollectionCapOptions } from "./execution-guards.js";
import { SandboxHandles } from "./cesium-bindings.js";
import { buildCesiumGuestPrelude } from "./bindings/guest-prelude.js";
import { registerHostBindings } from "./bindings/host-bridge.js";
import { noopLogger, type SandboxLogger } from "./logger.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;

/** Structured result returned to the caller of {@link runCesiumCodeInSandbox}. */
export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface RunCesiumCodeOptions extends SceneCollectionCapOptions {
  /** The untrusted, LLM-generated JavaScript source to execute. */
  code: string;
  /** The live Viewer the bound CesiumJS primitives (see `createProxiedViewer`) operate on. */
  viewer: Viewer;
  /** Execution time budget in milliseconds. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Maximum heap size (in bytes) the QuickJS interpreter is allowed to allocate while running
   * `code`. Defaults to {@link DEFAULT_MEMORY_LIMIT_BYTES}. Exceeding this aborts the script the
   * same way QuickJS's own out-of-memory handling normally would.
   */
  memoryLimitBytes?: number;
  /**
   * Logger used to report sandbox lifecycle events (run start/success/failure) and individual
   * host-bridge calls (property get/set, function apply/construct, async factory calls) crossing
   * the guest/host boundary. Defaults to a no-op logger — logging is entirely opt-in; pass
   * {@link createConsoleLogger} or {@link createSandboxLogger} (or your own {@link SandboxLogger})
   * to enable it.
   */
  logger?: SandboxLogger;
}

/** The live QuickJS async interpreter context, as returned by `newAsyncContext()`. */
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;

/**
 * Evaluates the fully-wrapped guest script and resolves with its final, host-dumped return value.
 * See `code-sandbox-quickjs.ts` for why the explicit `executePendingJobs()` pump is required:
 * `resolvePromise`'s returned promise only settles once QuickJS's own job queue runs the `.then`
 * handler it attaches internally, which doesn't happen automatically just by awaiting host
 * promises.
 */
async function evaluateWrappedCode(ctx: QuickJSAsyncContext, wrapped: string): Promise<unknown> {
  const evalResult = await ctx.evalCodeAsync(wrapped);
  const promiseHandle = ctx.unwrapResult(evalResult);
  const settlePromise = ctx.resolvePromise(promiseHandle);
  ctx.runtime.executePendingJobs();
  const settleResult = await settlePromise;
  promiseHandle.dispose();
  const resultHandle = ctx.unwrapResult(settleResult);
  const result = ctx.dump(resultHandle);
  resultHandle.dispose();
  return result;
}

/**
 * Runs untrusted `code` inside a fresh QuickJS-wasm interpreter bound to real CesiumJS
 * primitives derived from `viewer`, resolving with a structured result once the script
 * completes, throws, or the interrupt deadline is reached. A new interpreter and a new
 * {@link SandboxHandles} registry are created per call and disposed afterward, so no state,
 * bindings, or object handles leak between separate runs.
 */
export async function runCesiumCodeInSandbox({
  code,
  viewer,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  memoryLimitBytes = DEFAULT_MEMORY_LIMIT_BYTES,
  maxItemsPerCollection,
  logger = noopLogger,
}: RunCesiumCodeOptions): Promise<SandboxResult> {
  // `newAsyncContext()` itself can reject (e.g. the interpreter's WASM binary failing to load/
  // instantiate) — that must resolve to this function's documented `{ success:false, error }`
  // shape like every other failure here, not escape as an unhandled rejection. `vm` therefore
  // starts undefined and is only assigned (and only disposed in `finally`) once creation succeeds.
  let vm: QuickJSAsyncContext | undefined;

  logger.debug(
    `Starting sandbox run (codeLength=${code.length}, timeoutMs=${timeoutMs}, memoryLimitBytes=${memoryLimitBytes})`,
  );

  try {
    const ctx = await newAsyncContext();
    vm = ctx;
    const handles = new SandboxHandles();
    const deadline = Date.now() + timeoutMs;
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));
    ctx.runtime.setMemoryLimit(memoryLimitBytes);

    registerHostBindings(ctx, handles, { logger });

    const prelude = buildCesiumGuestPrelude(viewer, handles, maxItemsPerCollection);
    const wrapped = `${prelude}\n(async () => {\n${code}\n})();`;

    const result = await evaluateWrappedCode(ctx, wrapped);

    logger.debug("Sandbox run completed successfully");
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Sandbox run failed: ${message}`);
    return { success: false, error: message };
  } finally {
    vm?.dispose();
  }
}
