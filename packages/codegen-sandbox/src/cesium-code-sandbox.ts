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
import { registerHostBindings, type PendingHostWorkTracker } from "./bindings/host-bridge.js";
import { noopLogger, type SandboxLogger } from "./logger.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const DEFAULT_POST_RUN_DRAIN_MS = 2000;
const USER_CODE_ERROR_MARKER = "__CESIUM_SANDBOX_USER_CODE_ERROR__";

interface UserCodeErrorPayload {
  name: string;
  message: string;
  stack: string;
}

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
  /**
   * Bounded grace window (in milliseconds), after the guest script's own top-level `async`
   * function has settled, to let any still-pending dynamically bridged Promise the script called
   * without `await`ing (a fire-and-forget `.then(...)`) finish before the VM is disposed. See
   * {@link drainPendingHostWork}. Defaults to 2000ms; has no effect (returns immediately) when
   * there's no pending host work.
   */
  postRunDrainMs?: number;
  /** HTTP(S) origins that guest-provided Cesium URL arguments may target. Defaults to none. */
  allowedNetworkOrigins?: readonly string[];
  /** Allows guest-provided root/path-relative Cesium URL arguments. Defaults to false. */
  allowRelativeNetworkUrls?: boolean;
}

/** The live QuickJS async interpreter context, as returned by `newAsyncContext()`. */
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;

/**
 * Waits (in bounded, small polling increments, pumping the QuickJS job queue on every tick) for
 * `pendingWork.count` to reach zero, up to `deadline`. Guest code frequently calls a
 * Promise-returning host API (`Cesium.GeoJsonDataSource.load(...)`, `viewer.scene.pickAsync(...)`,
 * ...) as a fire-and-forget statement — chained with a bare `.then(...)` but never `await`ed or
 * `return`ed. Without this, the wrapped script's outer `async` function (and therefore
 * `evaluateWrappedCode`) resolves the instant the synchronous portion of the guest script finishes
 * — before that dangling Promise (and any `.then` continuation mutating the real `Viewer`) ever
 * settles — and the VM is disposed (see `finally` below) out from under it. `registerHostApply`'s
 * `deferred.alive` check means this fails silently rather than crashing, so the generated code
 * looks like it "succeeded" while never actually doing anything. This is a best-effort grace
 * window, not a guarantee — a Promise that never settles (e.g. a genuinely stalled network
 * request) simply exhausts the whole window before the VM is disposed anyway.
 */
async function drainPendingHostWork(
  ctx: QuickJSAsyncContext,
  pendingWork: PendingHostWorkTracker,
  deadline: number,
): Promise<void> {
  while (pendingWork.count > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    ctx.runtime.executePendingJobs();
  }
}

/**
 * Races `pending` against `deadline`, calling `ctx.runtime.executePendingJobs()` on every poll
 * tick while waiting — both to give the QuickJS engine's interrupt handler repeated chances to
 * notice `shouldInterruptAfterDeadline` has elapsed, AND (independently of whether the interrupt
 * ever actually fires) to guarantee this function itself settles no later than `deadline` even if
 * the engine is completely idle with nothing queued to run. See {@link evaluateWrappedCode}'s doc
 * comment for why relying on the interrupt handler alone is not sufficient. `pending` is allowed to
 * keep running in the background after a timeout "wins" the race — the caller's `finally` disposes
 * the whole VM regardless, and nothing here awaits `pending` any further.
 */
function raceAgainstDeadline<T>(
  ctx: QuickJSAsyncContext,
  pending: Promise<T>,
  deadline: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setInterval(() => {
      if (settled) return;
      try {
        ctx.runtime.executePendingJobs();
      } catch {
        // Ignore — a failure here just means this poll tick didn't advance anything; the next
        // tick (or the deadline check below) still governs when we give up.
      }
      if (Date.now() >= deadline) {
        settled = true;
        clearInterval(timer);
        reject(new Error("Sandbox execution timed out waiting for the guest script to settle."));
      }
    }, 10);

    pending.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        reject(error);
      },
    );
  });
}

/**
 * Evaluates the fully-wrapped guest script and resolves with its final, host-dumped return value.
 * See `code-sandbox-quickjs.ts` for why the explicit `executePendingJobs()` pump is required:
 * `resolvePromise`'s returned promise only settles once QuickJS's own job queue runs the `.then`
 * handler it attaches internally, which doesn't happen automatically just by awaiting host
 * promises.
 *
 * Every await here is wrapped in {@link raceAgainstDeadline}, not just the final settle: relying
 * solely on `ctx.runtime`'s interrupt handler (`shouldInterruptAfterDeadline`, installed by the
 * caller) is not sufficient on its own — it can only fire while the engine is actively executing
 * bytecode/pending jobs. A guest script `await`ing a host-bridged Promise that never settles (a
 * genuinely stalled call, or a test double stubbing one) can leave the engine fully idle with
 * nothing queued to run, so `executePendingJobs()` has zero jobs to process and never gives the
 * engine a chance to tick its interrupt check at all — this can stall not just the final
 * `resolvePromise` wait but, depending on exactly which async host call the guest is blocked in,
 * even the initial `evalCodeAsync` call itself, indefinitely, regardless of `timeoutMs`.
 */
async function evaluateWrappedCode(
  ctx: QuickJSAsyncContext,
  wrapped: string,
  deadline: number,
): Promise<unknown> {
  const evalResult = await raceAgainstDeadline(ctx, ctx.evalCodeAsync(wrapped), deadline);
  const promiseHandle = ctx.unwrapResult(evalResult);
  const settlePromise = ctx.resolvePromise(promiseHandle);
  ctx.runtime.executePendingJobs();
  const settleResult = await raceAgainstDeadline(ctx, settlePromise, deadline);
  promiseHandle.dispose();
  const resultHandle = ctx.unwrapResult(settleResult);
  const result = ctx.dump(resultHandle);
  resultHandle.dispose();
  return result;
}

function buildWrappedCode(
  prelude: string,
  code: string,
): { wrapped: string; codeStartLine: number } {
  const codeStartLine = prelude.split("\n").length + 3;
  const marker = JSON.stringify(USER_CODE_ERROR_MARKER);
  const wrapped = `${prelude}
(async () => {
try {
${code}
} catch (__cesiumSandboxUserError__) {
  const __cesiumSandboxErrorPayload__ = {
    name: __cesiumSandboxUserError__ && __cesiumSandboxUserError__.name
      ? String(__cesiumSandboxUserError__.name)
      : "Error",
    message: __cesiumSandboxUserError__ && __cesiumSandboxUserError__.message
      ? String(__cesiumSandboxUserError__.message)
      : String(__cesiumSandboxUserError__),
    stack: __cesiumSandboxUserError__ && __cesiumSandboxUserError__.stack
      ? String(__cesiumSandboxUserError__.stack)
      : "",
  };
  throw new Error(${marker} + JSON.stringify(__cesiumSandboxErrorPayload__));
}
})();`;
  return { wrapped, codeStartLine };
}

function formatUserCodeError(
  error: unknown,
  code: string,
  codeStartLine: number,
): string | undefined {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const markerIndex = rawMessage.indexOf(USER_CODE_ERROR_MARKER);
  if (markerIndex < 0) return undefined;

  let payload: UserCodeErrorPayload;
  try {
    payload = JSON.parse(rawMessage.slice(markerIndex + USER_CODE_ERROR_MARKER.length));
  } catch {
    return undefined;
  }

  const codeLines = code.split(/\r?\n/);
  const codeEndLine = codeStartLine + codeLines.length - 1;
  const locations = payload.stack.matchAll(/:(\d+)(?::(\d+))?\)?$/gm);
  for (const location of locations) {
    const wrappedLine = Number(location[1]);
    if (wrappedLine < codeStartLine || wrappedLine > codeEndLine) continue;

    const generatedLine = wrappedLine - codeStartLine + 1;
    const column = location[2] ? Number(location[2]) : undefined;
    const sourceLine = codeLines[generatedLine - 1]?.trim();
    const position = `generated code line ${generatedLine}${column ? `:${column}` : ""}`;
    return `${payload.name}: ${payload.message} at ${position}${sourceLine ? `\n> ${sourceLine}` : ""}`;
  }

  return `${payload.name}: ${payload.message} while executing generated Cesium code`;
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
  postRunDrainMs = DEFAULT_POST_RUN_DRAIN_MS,
  allowedNetworkOrigins,
  allowRelativeNetworkUrls,
}: RunCesiumCodeOptions): Promise<SandboxResult> {
  // `newAsyncContext()` itself can reject (e.g. the interpreter's WASM binary failing to load/
  // instantiate) — that must resolve to this function's documented `{ success:false, error }`
  // shape like every other failure here, not escape as an unhandled rejection. `vm` therefore
  // starts undefined and is only assigned (and only disposed in `finally`) once creation succeeds.
  let vm: QuickJSAsyncContext | undefined;
  let codeStartLine = 1;

  logger.info(
    `Starting sandbox run (codeLength=${code.length}, timeoutMs=${timeoutMs}, memoryLimitBytes=${memoryLimitBytes})`,
  );

  try {
    const ctx = await newAsyncContext();
    vm = ctx;
    const handles = new SandboxHandles();
    const deadline = Date.now() + timeoutMs;
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));
    ctx.runtime.setMemoryLimit(memoryLimitBytes);

    const pendingWork: PendingHostWorkTracker = { count: 0 };

    registerHostBindings(ctx, handles, {
      logger,
      pendingWork,
      allowedNetworkOrigins,
      allowRelativeNetworkUrls,
    });

    const prelude = buildCesiumGuestPrelude(viewer, handles, maxItemsPerCollection);
    const wrappedCode = buildWrappedCode(prelude, code);
    codeStartLine = wrappedCode.codeStartLine;

    const result = await evaluateWrappedCode(ctx, wrappedCode.wrapped, deadline);
    await drainPendingHostWork(ctx, pendingWork, Date.now() + postRunDrainMs);

    logger.info("Sandbox run completed successfully");
    return { success: true, result };
  } catch (err) {
    const message =
      formatUserCodeError(err, code, codeStartLine) ??
      (err instanceof Error ? err.message : String(err));
    logger.error(`Sandbox run failed: ${message}`);
    return { success: false, error: message };
  } finally {
    vm?.dispose();
  }
}
