import { newAsyncContext } from "quickjs-emscripten";
import { DEFAULT_CESIUM_ASYNC_FACTORIES } from "./cesium-async-factories.js";
import { assertSandboxPropertyAllowed } from "./guarded-viewer-proxy.js";
import type { SandboxHandles } from "./sandbox-handles.js";
import { noopLogger, type SandboxLogger } from "../logger.js";

type HostCallEnvelope = { ok: true; value: unknown } | { ok: false; error: string };
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;
type AsyncBinding = (...args: unknown[]) => Promise<unknown>;

export interface RegisterHostBindingsOptions {
  deadline: number;
  /** Reports individual guest/host boundary crossings. Defaults to {@link noopLogger}. */
  logger?: SandboxLogger;
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

function registerHostGet(ctx: QuickJSAsyncContext, handles: SandboxHandles, logger: SandboxLogger): void {
  const hostFunction = ctx.newFunction("__cesiumSandboxHostGetSync__", (handleIdHandle, propHandle) => {
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
  });
  ctx.setProp(ctx.global, "__cesiumSandboxHostGetSync__", hostFunction);
  hostFunction.dispose();
}


function registerHostSet(ctx: QuickJSAsyncContext, handles: SandboxHandles, logger: SandboxLogger): void {
  const hostFunction = ctx.newFunction(
    "__cesiumSandboxHostSetSync__",
    (handleIdHandle, propHandle, valueHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const prop = ctx.getString(propHandle);
      try {
        assertSandboxPropertyAllowed(prop);
        const target = handles.resolve(handleId);
        const value = handles.unwrap(JSON.parse(ctx.getString(valueHandle)) as unknown);
        Reflect.set(target as object, prop, value);
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

function registerHostApply(ctx: QuickJSAsyncContext, handles: SandboxHandles, logger: SandboxLogger): void {
  const hostFunction = ctx.newFunction("__cesiumSandboxHostApplySync__", (handleIdHandle, argsHandle) => {
    const handleId = ctx.getString(handleIdHandle);
    try {
      const callable = handles.resolve(handleId);
      if (typeof callable !== "function") throw new Error("Sandbox handle is not callable");
      const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
        handles.unwrap(arg),
      );
      logger.debug(`apply on handle ${handleId} (${args.length} arg(s))`);
      const result = (callable as (...args: unknown[]) => unknown)(...args);
      if (isPromiseLike(result)) {
        // Bridge the host Promise into a genuine QuickJS promise via `ctx.newPromise()` instead
        // of quickjs-emscripten's Asyncify mechanism. An earlier design retained the host promise
        // and had the guest re-enter through the (Asyncify-backed) `__cesiumSandboxHostCallAsync__`
        // bridge to consume it — but Asyncify only reliably suspends/resumes a single in-flight
        // call driven by `evaluateWrappedCode`'s own `executePendingJobs()` pump; reusing it here
        // reproducibly hung the guest script and, since the underlying WASM module/heap is shared
        // across every `newAsyncContext()` in the process, could crash unrelated later test runs
        // with a native `memory access out of bounds`/`p->ref_count == 0` abort. `newPromise()` +
        // `executePendingJobs()` is the same mechanism `evaluateWrappedCode` already uses to
        // settle the outer script promise, needs no Asyncify support, and — unlike the old
        // mechanism — supports any number of concurrent/sequential dynamic-Promise calls per
        // script rather than just one.
        const deferred = ctx.newPromise();
        Promise.resolve(result).then(
          (value) => {
            // `deferred.alive` is false once the sandbox has already disposed its VM/runtime
            // (e.g. after a timeout). In that case the runtime itself may no longer exist, so
            // calling `executePendingJobs()` would be a use-after-free — skip settling entirely.
            if (!deferred.alive) return;
            deferred.resolve(toEnvelopeString(ctx, { ok: true, value: handles.wrap(value ?? null) }));
            ctx.runtime.executePendingJobs();
          },
          (error: unknown) => {
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
  });
  ctx.setProp(ctx.global, "__cesiumSandboxHostApplySync__", hostFunction);
  hostFunction.dispose();
}


function registerHostConstruct(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  logger: SandboxLogger,
): void {
  const hostFunction = ctx.newFunction("__cesiumSandboxHostConstructSync__", (handleIdHandle, argsHandle) => {
    const handleId = ctx.getString(handleIdHandle);
    try {
      const constructor = handles.resolve(handleId);
      if (typeof constructor !== "function") {
        throw new Error("Sandbox handle is not constructable");
      }
      const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
        handles.unwrap(arg),
      );
      const result = Reflect.construct(constructor as new (...args: unknown[]) => unknown, args);
      logger.debug(`construct on handle ${handleId} (${args.length} arg(s))`);
      return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
    } catch (error) {
      logger.warn(`construct on handle ${handleId} failed: ${errorMessage(error)}`);
      return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
    }
  });
  ctx.setProp(ctx.global, "__cesiumSandboxHostConstructSync__", hostFunction);
  hostFunction.dispose();
}

function createAsyncBindings(): Map<string, AsyncBinding> {
  return new Map<string, AsyncBinding>(
    Object.entries(DEFAULT_CESIUM_ASYNC_FACTORIES) as [string, AsyncBinding][],
  );
}

function registerHostCallAsync(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  { deadline, logger }: RegisterHostBindingsOptions & { logger: SandboxLogger },
): void {
  const bindings = createAsyncBindings();
  let asyncCallCount = 0;

  const hostFunction = ctx.newAsyncifiedFunction(
    "__cesiumSandboxHostCallAsync__",
    async (nameHandle, argsHandle) => {
      const name = ctx.getString(nameHandle);
      asyncCallCount += 1;
      if (asyncCallCount > 1) {
        logger.warn(`rejected 2nd async call "${name}" (only one async call allowed per script)`);
        return toEnvelopeString(ctx, {
          ok: false,
          error:
            "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script.",
        });
      }

      const binding = bindings.get(name);
      if (!binding) {
        logger.warn(`unknown async CesiumJS factory "${name}"`);
        return toEnvelopeString(ctx, {
          ok: false,
          error: `Unknown async CesiumJS factory "${name}"`,
        });
      }

      try {
        const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
          handles.unwrap(arg),
        );
        logger.debug(`async call "${name}" (${args.length} arg(s))`);
        const remainingMs = Math.max(0, deadline - Date.now());
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Cesium sandbox execution timed out.")),
            remainingMs,
          );
        });
        const value = await Promise.race([binding(...args), timeout]).finally(() => {
          if (timeoutId !== undefined) clearTimeout(timeoutId);
        });
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(value ?? null) });
      } catch (error) {
        logger.warn(`async call "${name}" failed: ${errorMessage(error)}`);
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__cesiumSandboxHostCallAsync__", hostFunction);
  hostFunction.dispose();
}

/** Registers the complete host API consumed by the guest-side binding preludes. */
export function registerHostBindings(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  options: RegisterHostBindingsOptions,
): void {
  const logger = options.logger ?? noopLogger;
  registerHostGet(ctx, handles, logger);
  registerHostSet(ctx, handles, logger);
  registerHostApply(ctx, handles, logger);
  registerHostConstruct(ctx, handles, logger);
  registerHostCallAsync(ctx, handles, { ...options, logger });
}
