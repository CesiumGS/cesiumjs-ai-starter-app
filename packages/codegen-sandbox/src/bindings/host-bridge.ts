import { newAsyncContext } from "quickjs-emscripten";
import { assertSandboxPropertyAllowed } from "./guarded-viewer-proxy.js";
import type { SandboxHandles } from "./sandbox-handles.js";
import { noopLogger, type SandboxLogger } from "../logger.js";
import {
  assertNetworkUrlsAllowed,
  createNetworkUrlPolicy,
  type NetworkUrlPolicy,
} from "./network-url-policy.js";

type HostCallEnvelope = { ok: true; value: unknown } | { ok: false; error: string };
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;

/**
 * Tracks how many dynamically bridged host Promises (see `registerHostApply` below) are still
 * in flight. Guest code that calls a Promise-returning host API without `await`ing (or otherwise
 * chaining onto) it — e.g. `Cesium.GeoJsonDataSource.load(url).then((ds) => viewer.dataSources.
 * add(ds))` as a fire-and-forget statement — lets the wrapped script's own top-level `async`
 * function resolve *before* that Promise (and any `.then` continuation closing over real
 * `Viewer` mutations) ever settles. `cesium-code-sandbox.ts` uses this counter to give such
 * still-pending work a bounded grace window to finish before disposing the VM out from under it.
 */
export interface PendingHostWorkTracker {
  count: number;
}

export interface RegisterHostBindingsOptions {
  /** Reports individual guest/host boundary crossings. Defaults to {@link noopLogger}. */
  logger?: SandboxLogger;
  /**
   * Incremented for every dynamically bridged Promise created by `registerHostApply` and
   * decremented once it settles. Defaults to a private, unobserved counter if omitted.
   */
  pendingWork?: PendingHostWorkTracker;
  /** Absolute HTTP(S) origins guest-provided URL arguments may target. Defaults to none. */
  allowedNetworkOrigins?: readonly string[];
  /** Whether guest-provided root/path-relative URL arguments are allowed. Defaults to false. */
  allowRelativeNetworkUrls?: boolean;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toEnvelopeString(ctx: QuickJSAsyncContext, envelope: HostCallEnvelope) {
  return ctx.newString(JSON.stringify(envelope));
}

function registerHostGet(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostGetSync__",
    (handleIdHandle, propHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const prop = ctx.getString(propHandle);
      try {
        assertSandboxPropertyAllowed(prop);
        const target = handles.resolve(handleId);
        const property = Reflect.get(target as object, prop);

        // An apply-only Proxy preserves a method's `this` without stripping static class members,
        // as Function.prototype.bind would do for classes such as Cesium.Rectangle.
        const value =
          typeof property === "function"
            ? new Proxy(property as (...args: unknown[]) => unknown, {
                apply: (fn, _thisArg, args) => Reflect.apply(fn, target, args),
              })
            : property;
        logger.debug(`get "${prop}" on handle ${handleId}`);
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(value) });
      } catch (error) {
        logger.warn(`get "${prop}" on handle ${handleId} failed: ${errorMessage(error)}`);
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostGetSync__", hostFunction);
  hostFunction.dispose();
}

function registerHostSet(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
  networkUrlPolicy: NetworkUrlPolicy,
): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostSetSync__",
    (handleIdHandle, propHandle, valueHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const prop = ctx.getString(propHandle);
      try {
        assertSandboxPropertyAllowed(prop);
        const target = handles.resolve(handleId);
        const encodedValue = JSON.parse(ctx.getString(valueHandle)) as unknown;
        assertNetworkUrlsAllowed(encodedValue, networkUrlPolicy);
        const value = handles.unwrap(encodedValue);
        if (!Reflect.set(target as object, prop, value)) {
          throw new Error(`Could not assign Cesium property "${prop}"`);
        }
        logger.debug(`set "${prop}" on handle ${handleId}`);
        return toEnvelopeString(ctx, { ok: true, value: null });
      } catch (error) {
        logger.warn(`set "${prop}" on handle ${handleId} failed: ${errorMessage(error)}`);
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostSetSync__", hostFunction);
  hostFunction.dispose();
}

function registerHostApply(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
  pendingWork: PendingHostWorkTracker,
  networkUrlPolicy: NetworkUrlPolicy,
): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostApplySync__",
    (handleIdHandle, argsHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      try {
        const callable = handles.resolve(handleId);
        if (typeof callable !== "function") throw new Error("Sandbox handle is not callable");
        const encodedArgs = JSON.parse(ctx.getString(argsHandle)) as unknown[];
        assertNetworkUrlsAllowed(encodedArgs, networkUrlPolicy);
        const args = encodedArgs.map((arg) => handles.unwrap(arg));
        logger.debug(`apply on handle ${handleId} (${args.length} arg(s))`);
        const result = (callable as (...args: unknown[]) => unknown)(...args);
        if (isPromiseLike(result)) {
          pendingWork.count++;
          // Bridge the host Promise into a genuine QuickJS promise via `ctx.newPromise()` instead
          // of quickjs-emscripten's Asyncify mechanism. An earlier design retained the host promise
          // and had the guest re-enter through a dedicated Asyncify-backed bridge to consume it —
          // but Asyncify only reliably suspends/resumes a single in-flight call driven by
          // `evaluateWrappedCode`'s own `executePendingJobs()` pump; reusing it here reproducibly
          // hung the guest script and, since the underlying WASM module/heap is shared across every
          // `newAsyncContext()` in the process, could crash unrelated later test runs with a native
          // `memory access out of bounds`/`p->ref_count == 0` abort. `newPromise()` +
          // `executePendingJobs()` is the same mechanism `evaluateWrappedCode` already uses to
          // settle the outer script promise, needs no Asyncify support, and — unlike the old
          // mechanism — supports any number of concurrent/sequential dynamic-Promise calls per
          // script rather than just one. This is now the *only* bridge for Promise-returning calls
          // (see `cesium-async-factories.ts`'s removal): the small set of genuinely async,
          // network/Ion-backed factories that used to be routed through the dedicated Asyncify
          // bridge (`createWorldImageryAsync`, `Cesium3DTileset.fromUrl`, ...) now flow through
          // here exactly like every other Promise-returning API.
          const deferred = ctx.newPromise();
          Promise.resolve(result).then(
            (value) => {
              pendingWork.count--;
              // `deferred.alive` is false once the sandbox has already disposed its VM/runtime
              // (e.g. after a timeout). In that case the runtime itself may no longer exist, so
              // calling `executePendingJobs()` would be a use-after-free — skip settling entirely.
              if (!deferred.alive) return;
              deferred.resolve(
                toEnvelopeString(ctx, { ok: true, value: handles.wrap(value ?? null) }),
              );
              ctx.runtime.executePendingJobs();
            },
            (error: unknown) => {
              pendingWork.count--;
              if (!deferred.alive) return;
              logger.warn(`apply on handle ${handleId} failed: ${errorMessage(error)}`);
              deferred.resolve(toEnvelopeString(ctx, { ok: false, error: errorMessage(error) }));
              ctx.runtime.executePendingJobs();
            },
          );
          return deferred.handle;
        }
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
      } catch (error) {
        logger.warn(`apply on handle ${handleId} failed: ${errorMessage(error)}`);
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostApplySync__", hostFunction);
  hostFunction.dispose();
}

function registerHostConstruct(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
  networkUrlPolicy: NetworkUrlPolicy,
): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostConstructSync__",
    (handleIdHandle, argsHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      try {
        const constructor = handles.resolve(handleId);
        if (typeof constructor !== "function") {
          throw new Error("Sandbox handle is not constructable");
        }
        const encodedArgs = JSON.parse(ctx.getString(argsHandle)) as unknown[];
        assertNetworkUrlsAllowed(encodedArgs, networkUrlPolicy);
        const args = encodedArgs.map((arg) => handles.unwrap(arg));
        const result = Reflect.construct(constructor as new (...args: unknown[]) => unknown, args);
        logger.debug(`construct on handle ${handleId} (${args.length} arg(s))`);
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
      } catch (error) {
        logger.warn(`construct on handle ${handleId} failed: ${errorMessage(error)}`);
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostConstructSync__", hostFunction);
  hostFunction.dispose();
}

/**
 * Backs the guest's `instance instanceof Cesium.SomeClass` support for classes reached through
 * the remote-proxy bridge (e.g. the static-namespace fallback). The real `instanceof` operator
 * internally does `Get(Ctor, "prototype")`, which `registerHostGet` unconditionally rejects (see
 * `assertSandboxPropertyAllowed`) — `prototype` is deliberately blocked there since exposing a
 * real prototype object to guest code is a classic sandbox-escape vector (e.g. walking up to
 * `Function.prototype.constructor`). This performs the comparison entirely host-side instead,
 * resolving both the instance and constructor to their real underlying objects and returning only
 * a plain boolean — no prototype object ever crosses the boundary.
 */
function registerHostInstanceOf(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostInstanceOfSync__",
    (instanceHandleIdHandle, ctorHandleIdHandle) => {
      const instanceHandleId = ctx.getString(instanceHandleIdHandle);
      const ctorHandleId = ctx.getString(ctorHandleIdHandle);
      try {
        const instance = handles.resolve(instanceHandleId);
        const ctor = handles.resolve(ctorHandleId);
        if (typeof ctor !== "function") {
          throw new Error("Sandbox handle is not a constructor");
        }
        const result = instance instanceof ctor;
        logger.debug(
          `instanceof check: handle ${instanceHandleId} instanceof handle ${ctorHandleId} -> ${result}`,
        );
        return toEnvelopeString(ctx, { ok: true, value: result });
      } catch (error) {
        logger.warn(
          `instanceof check on handle ${instanceHandleId} failed: ${errorMessage(error)}`,
        );
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostInstanceOfSync__", hostFunction);
  hostFunction.dispose();
}

/** Registers the complete host API consumed by the guest-side binding preludes. */
export function registerHostBindings(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  options: RegisterHostBindingsOptions,
): void {
  const logger = options.logger ?? noopLogger;
  const pendingWork = options.pendingWork ?? { count: 0 };
  const networkUrlPolicy = createNetworkUrlPolicy(
    options.allowedNetworkOrigins,
    options.allowRelativeNetworkUrls,
  );
  registerHostGet(ctx, handles, logger);
  registerHostSet(ctx, handles, logger, networkUrlPolicy);
  registerHostApply(ctx, handles, logger, pendingWork, networkUrlPolicy);
  registerHostConstruct(ctx, handles, logger, networkUrlPolicy);
  registerHostInstanceOf(ctx, handles, logger);
}
