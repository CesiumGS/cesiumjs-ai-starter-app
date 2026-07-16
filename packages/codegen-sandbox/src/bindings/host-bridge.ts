import type { Viewer } from "cesium";
import { newAsyncContext } from "quickjs-emscripten";
import { DEFAULT_CESIUM_ASYNC_FACTORIES } from "./cesium-async-factories.js";
import { assertSandboxPropertyAllowed } from "./guarded-viewer-proxy.js";
import type { SandboxHandles } from "./sandbox-handles.js";

type HostCallEnvelope = { ok: true; value: unknown } | { ok: false; error: string };
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;
type AsyncBinding = (...args: unknown[]) => Promise<unknown>;

export interface RegisterHostBindingsOptions {
  deadline: number;
  viewer: Viewer;
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

function registerHostGet(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostFunction = ctx.newFunction("__hostGetSync__", (handleIdHandle, propHandle) => {
    try {
      const prop = ctx.getString(propHandle);
      assertSandboxPropertyAllowed(prop);
      const target = handles.resolve(ctx.getString(handleIdHandle));
      const property = Reflect.get(target as object, prop);

      // An apply-only Proxy preserves a method's `this` without stripping static class members,
      // as Function.prototype.bind would do for classes such as Cesium.Rectangle.
      const value =
        typeof property === "function"
          ? new Proxy(property as (...args: unknown[]) => unknown, {
              apply: (fn, _thisArg, args) => Reflect.apply(fn, target, args),
            })
          : property;
      return toEnvelopeString(ctx, { ok: true, value: handles.wrap(value) });
    } catch (error) {
      return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
    }
  });
  ctx.setProp(ctx.global, "__hostGetSync__", hostFunction);
  hostFunction.dispose();
}

function registerHostSet(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostFunction = ctx.newFunction(
    "__hostSetSync__",
    (handleIdHandle, propHandle, valueHandle) => {
      try {
        const prop = ctx.getString(propHandle);
        assertSandboxPropertyAllowed(prop);
        const target = handles.resolve(ctx.getString(handleIdHandle));
        const value = handles.unwrap(JSON.parse(ctx.getString(valueHandle)) as unknown);
        Reflect.set(target as object, prop, value);
        return toEnvelopeString(ctx, { ok: true, value: null });
      } catch (error) {
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostSetSync__", hostFunction);
  hostFunction.dispose();
}

function registerHostApply(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostFunction = ctx.newFunction("__hostApplySync__", (handleIdHandle, argsHandle) => {
    try {
      const callable = handles.resolve(ctx.getString(handleIdHandle));
      if (typeof callable !== "function") throw new Error("Sandbox handle is not callable");
      const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
        handles.unwrap(arg),
      );
      const result = (callable as (...args: unknown[]) => unknown)(...args);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
        throw new Error(
          "Promise-returning Cesium APIs must use an explicitly supported async sandbox binding.",
        );
      }
      return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
    } catch (error) {
      return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
    }
  });
  ctx.setProp(ctx.global, "__hostApplySync__", hostFunction);
  hostFunction.dispose();
}

function registerHostConstruct(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostFunction = ctx.newFunction("__hostConstructSync__", (handleIdHandle, argsHandle) => {
    try {
      const constructor = handles.resolve(ctx.getString(handleIdHandle));
      if (typeof constructor !== "function") {
        throw new Error("Sandbox handle is not constructable");
      }
      const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
        handles.unwrap(arg),
      );
      const result = Reflect.construct(
        constructor as new (...args: unknown[]) => unknown,
        args,
      );
      return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
    } catch (error) {
      return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
    }
  });
  ctx.setProp(ctx.global, "__hostConstructSync__", hostFunction);
  hostFunction.dispose();
}

function createAsyncBindings(viewer: Viewer): Map<string, AsyncBinding> {
  return new Map<string, AsyncBinding>([
    ...Object.entries(DEFAULT_CESIUM_ASYNC_FACTORIES),
    ["viewerFlyTo", (target, options) => viewer.flyTo(target as never, options as never)],
    ["viewerZoomTo", (target, offset) => viewer.zoomTo(target as never, offset as never)],
  ] as [string, AsyncBinding][]);
}

function registerHostCallAsync(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  { deadline, viewer }: RegisterHostBindingsOptions,
): void {
  const bindings = createAsyncBindings(viewer);
  let asyncCallCount = 0;

  const hostFunction = ctx.newAsyncifiedFunction(
    "__hostCallAsync__",
    async (nameHandle, argsHandle) => {
      const name = ctx.getString(nameHandle);
      asyncCallCount += 1;
      if (asyncCallCount > 1) {
        return toEnvelopeString(ctx, {
          ok: false,
          error:
            "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script.",
        });
      }

      const binding = bindings.get(name);
      if (!binding) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: `Unknown async CesiumJS factory "${name}"`,
        });
      }

      try {
        const args = (JSON.parse(ctx.getString(argsHandle)) as unknown[]).map((arg) =>
          handles.unwrap(arg),
        );
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
        return toEnvelopeString(ctx, { ok: false, error: errorMessage(error) });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostCallAsync__", hostFunction);
  hostFunction.dispose();
}

/** Registers the complete host API consumed by the guest-side binding preludes. */
export function registerHostBindings(
  ctx: QuickJSAsyncContext,
  handles: SandboxHandles,
  options: RegisterHostBindingsOptions,
): void {
  registerHostGet(ctx, handles);
  registerHostSet(ctx, handles);
  registerHostApply(ctx, handles);
  registerHostConstruct(ctx, handles);
  registerHostCallAsync(ctx, handles, options);
}