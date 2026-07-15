/**
 * QuickJS-wasm sandbox that executes LLM-generated code directly against a real, bound CesiumJS
 * API surface (see `cesium-bindings.ts`), instead of a fixed set of pre-implemented capability
 * functions. The frontend's role here is purely mechanical: create an isolated interpreter, bind
 * the allowed real symbols, marshal calls across the boundary, and enforce resource limits — it
 * never decides what CesiumJS calls a given user intent should produce.
 */
import { newAsyncContext, shouldInterruptAfterDeadline } from "quickjs-emscripten";
import type { Viewer } from "cesium";
import * as CesiumNamespace from "cesium";
import {
  DEFAULT_CESIUM_ASYNC_FACTORIES,
  SandboxHandles,
  buildCesiumAsyncFactoryGuestPrelude,
  buildCesiumHostBridgeGuestPrelude,
  buildCesiumStaticFallbackGuestPrelude,
  buildCesiumValueTypeGuestPrelude,
  assertSandboxPropertyAllowed,
  createProxiedViewer,
} from "./cesium-bindings.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;

/** Structured result returned to the caller of {@link runCesiumCodeInSandbox}. */
export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface RunCesiumCodeOptions {
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
}

/** Shape of the JSON envelope the host bridge functions return across the host/VM boundary. */
type HostCallEnvelope = { ok: true; value: unknown } | { ok: false; error: string };

/** The live QuickJS async interpreter context, as returned by `newAsyncContext()`. */
type QuickJSAsyncContext = Awaited<ReturnType<typeof newAsyncContext>>;

function toEnvelopeString(ctx: QuickJSAsyncContext, envelope: HostCallEnvelope) {
  return ctx.newString(JSON.stringify(envelope));
}

/**
 * Registers `__hostGetSync__`: the property-read half of the generic synchronous remote-proxy
 * bridge (see `buildCesiumHostBridgeGuestPrelude`) — the guest never enumerates a static list of
 * bound symbols, every `viewer.*`/`Cesium.*` property read is dispatched dynamically by opaque
 * handle id, so adding support for a new real Cesium API never requires touching this marshaling
 * layer.
 */
function registerHostGetSync(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostGetSyncHandle = ctx.newFunction("__hostGetSync__", (handleIdHandle, propHandle) => {
    const handleId = ctx.getString(handleIdHandle);
    const prop = ctx.getString(propHandle);
    try {
      assertSandboxPropertyAllowed(prop);
      const target = handles.resolve(handleId);
      const real = Reflect.get(target as object, prop);
      // Methods must keep their real `this` (the object/namespace they were read off), but
      // plain `real.bind(target)` is wrong for anything that also carries its OWN properties as
      // a function object — most notably a *class* reached as a static namespace member (e.g.
      // `Cesium.Rectangle`, whose own static `.fromDegrees`/`.MAX_VALUE` live directly on the
      // `Rectangle` function object, not on `Function.prototype`): `Function.prototype.bind()`
      // returns a distinct exotic function object that does NOT copy the original's own
      // properties, so a subsequent `Cesium.Rectangle.fromDegrees` lookup on the bound clone
      // would silently resolve to `undefined` ("... is not a function"). Wrapping in a
      // `Proxy` instead preserves `this` for calls (via the `apply` trap) while leaving every
      // property read to fall through to the *original* function object by default, so static
      // properties survive.
      const value =
        typeof real === "function"
          ? new Proxy(real as (...a: unknown[]) => unknown, {
              apply: (fn, _thisArg, args) => Reflect.apply(fn, target, args),
            })
          : real;
      return toEnvelopeString(ctx, { ok: true, value: handles.wrap(value) });
    } catch (err) {
      return toEnvelopeString(ctx, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
  ctx.setProp(ctx.global, "__hostGetSync__", hostGetSyncHandle);
  hostGetSyncHandle.dispose();
}

/**
 * Registers `__hostSetSync__`: the property-assignment counterpart to `__hostGetSync__` — real
 * CesiumJS relies heavily on plain property assignment (`tileset.style = ...`,
 * `viewer.scene.globe.terrainProvider = ...`, `entity.polygon.material = ...`) rather than setter
 * methods, so without this the guest remote proxy's `set` trap would have nothing real to forward
 * to.
 */
function registerHostSetSync(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostSetSyncHandle = ctx.newFunction(
    "__hostSetSync__",
    (handleIdHandle, propHandle, valueHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const prop = ctx.getString(propHandle);
      const valueJson = ctx.getString(valueHandle);
      try {
        assertSandboxPropertyAllowed(prop);
        const target = handles.resolve(handleId);
        const rawValue = JSON.parse(valueJson) as unknown;
        const value = handles.unwrap(rawValue);
        Reflect.set(target as object, prop, value);
        return toEnvelopeString(ctx, { ok: true, value: null });
      } catch (err) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostSetSync__", hostSetSyncHandle);
  hostSetSyncHandle.dispose();
}

/** Registers `__hostApplySync__`: invokes a bound function handle with marshaled arguments. */
function registerHostApplySync(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostApplySyncHandle = ctx.newFunction(
    "__hostApplySync__",
    (handleIdHandle, argsHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const argsJson = ctx.getString(argsHandle);
      try {
        const fn = handles.resolve(handleId);
        if (typeof fn !== "function") throw new Error("Sandbox handle is not callable");
        const rawArgs = JSON.parse(argsJson) as unknown[];
        const unwrapped = rawArgs.map((arg) => handles.unwrap(arg));
        const result = (fn as (...a: unknown[]) => unknown)(...unwrapped);
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
      } catch (err) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostApplySync__", hostApplySyncHandle);
  hostApplySyncHandle.dispose();
}

/**
 * Registers `__hostConstructSync__`: the constructor counterpart to `__hostApplySync__` —
 * supports `new Cesium.SomeClass(...)` for real CesiumJS classes reached through the
 * static-namespace fallback (see `buildCesiumStaticFallbackGuestPrelude`), e.g. `new
 * Cesium.PinBuilder()`, `new Cesium.WebMapServiceImageryProvider({...})`.
 */
function registerHostConstructSync(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const hostConstructSyncHandle = ctx.newFunction(
    "__hostConstructSync__",
    (handleIdHandle, argsHandle) => {
      const handleId = ctx.getString(handleIdHandle);
      const argsJson = ctx.getString(argsHandle);
      try {
        const ctor = handles.resolve(handleId);
        if (typeof ctor !== "function") throw new Error("Sandbox handle is not constructable");
        const rawArgs = JSON.parse(argsJson) as unknown[];
        const unwrapped = rawArgs.map((arg) => handles.unwrap(arg));
        const result = Reflect.construct(ctor as new (...a: unknown[]) => unknown, unwrapped);
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(result ?? null) });
      } catch (err) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostConstructSync__", hostConstructSyncHandle);
  hostConstructSyncHandle.dispose();
}

/**
 * Registers all four synchronous host bridge functions (`__hostGetSync__`/`__hostSetSync__`/
 * `__hostApplySync__`/`__hostConstructSync__`) backing the guest's generic remote-proxy bridge.
 */
function registerSyncHostBridge(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  registerHostGetSync(ctx, handles);
  registerHostSetSync(ctx, handles);
  registerHostApplySync(ctx, handles);
  registerHostConstructSync(ctx, handles);
}

/**
 * Registers `__hostCallAsync__`: the Asyncify bridge reserved exclusively for the small, fixed
 * set of genuinely async `Cesium.*` factories (imagery/terrain providers, 3D Tiles, GeoJSON — see
 * `buildCesiumAsyncFactoryGuestPrelude`). quickjs-emscripten's current Asyncify build has a
 * reproducible native `free_zero_refcount` crash once more than one *asyncified* host call
 * executes in a script bound to a larger symbol prelude (verified via isolated repro scripts —
 * not a bug in this module's own marshaling logic), so a second async factory call in the same
 * script is rejected explicitly here rather than risking that crash.
 */
function registerAsyncHostBridge(ctx: QuickJSAsyncContext, handles: SandboxHandles): void {
  const asyncDispatch = new Map<string, (...args: unknown[]) => Promise<unknown>>([
    ["createWorldImageryAsync", DEFAULT_CESIUM_ASYNC_FACTORIES.createWorldImageryAsync],
    ["createOsmBuildingsAsync", DEFAULT_CESIUM_ASYNC_FACTORIES.createOsmBuildingsAsync],
    ["createWorldTerrainAsync", DEFAULT_CESIUM_ASYNC_FACTORIES.createWorldTerrainAsync],
    ["createWorldBathymetryAsync", DEFAULT_CESIUM_ASYNC_FACTORIES.createWorldBathymetryAsync],
    ["cesium3DTilesetFromUrl", DEFAULT_CESIUM_ASYNC_FACTORIES.cesium3DTilesetFromUrl],
    [
      "cesium3DTilesetFromIonAssetId",
      DEFAULT_CESIUM_ASYNC_FACTORIES.cesium3DTilesetFromIonAssetId,
    ],
    [
      "cesiumTerrainProviderFromIonAssetId",
      DEFAULT_CESIUM_ASYNC_FACTORIES.cesiumTerrainProviderFromIonAssetId,
    ],
    ["geoJsonDataSourceLoad", DEFAULT_CESIUM_ASYNC_FACTORIES.geoJsonDataSourceLoad],
    ["modelFromGltfAsync", DEFAULT_CESIUM_ASYNC_FACTORIES.modelFromGltfAsync],
  ] as [string, (...args: unknown[]) => Promise<unknown>][]);
  let asyncCallCount = 0;

  const hostCallAsyncHandle = ctx.newAsyncifiedFunction(
    "__hostCallAsync__",
    async (nameHandle, argsHandle) => {
      const name = ctx.getString(nameHandle);
      const argsJson = ctx.getString(argsHandle);
      asyncCallCount += 1;
      if (asyncCallCount > 1) {
        return toEnvelopeString(ctx, {
          ok: false,
          error:
            "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script.",
        });
      }

      const factory = asyncDispatch.get(name);
      if (!factory) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: `Unknown async CesiumJS factory "${name}"`,
        });
      }
      try {
        const rawArgs = JSON.parse(argsJson) as unknown[];
        const unwrapped = rawArgs.map((arg) => handles.unwrap(arg));
        const value = await factory(...unwrapped);
        return toEnvelopeString(ctx, { ok: true, value: handles.wrap(value ?? null) });
      } catch (err) {
        return toEnvelopeString(ctx, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
  ctx.setProp(ctx.global, "__hostCallAsync__", hostCallAsyncHandle);
  hostCallAsyncHandle.dispose();
}

/**
 * Wraps the live `viewer` and the real static `Cesium` module namespace as root sandbox handles,
 * then joins every guest-side prelude (value types, host bridge, static-namespace fallback, async
 * factories) plus the `viewer` binding into the single flat script prefix every generated snippet
 * runs after.
 */
function buildGuestPrelude(viewer: Viewer, handles: SandboxHandles): string {
  const viewerHandleId = handles.wrapRoot(createProxiedViewer(viewer));
  // Root handle for the real, static `Cesium` module namespace — lets the guest-side static
  // fallback proxy (see `buildCesiumStaticFallbackGuestPrelude`) reach any real CesiumJS class
  // not explicitly reimplemented as a pure guest-side value type (`Rectangle`, `Ellipsoid`,
  // `PinBuilder`, `GeoJsonPrimitive`, `Material`, `CustomShader`, ...) through the same generic,
  // dynamically-dispatched remote-proxy bridge already used for `viewer`.
  const staticCesiumHandleId = handles.wrapRoot(CesiumNamespace);

  return [
    buildCesiumValueTypeGuestPrelude(),
    buildCesiumHostBridgeGuestPrelude(),
    buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId),
    buildCesiumAsyncFactoryGuestPrelude(),
    `const viewer = __remoteProxy__(${JSON.stringify(viewerHandleId)});`,
  ].join("\n");
}

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
 * Runs untrusted `options.code` inside a fresh QuickJS-wasm interpreter bound to real CesiumJS
 * primitives derived from `options.viewer`, resolving with a structured result once the script
 * completes, throws, or the interrupt deadline is reached. A new interpreter and a new
 * {@link SandboxHandles} registry are created per call and disposed afterward, so no state,
 * bindings, or object handles leak between separate runs.
 */
export async function runCesiumCodeInSandbox(
  options: RunCesiumCodeOptions,
): Promise<SandboxResult> {
  const {
    code,
    viewer,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    memoryLimitBytes = DEFAULT_MEMORY_LIMIT_BYTES,
  } = options;
  // `newAsyncContext()` itself can reject (e.g. the interpreter's WASM binary failing to load/
  // instantiate) — that must resolve to this function's documented `{ success:false, error }`
  // shape like every other failure here, not escape as an unhandled rejection. `vm` therefore
  // starts undefined and is only assigned (and only disposed in `finally`) once creation succeeds.
  let vm: QuickJSAsyncContext | undefined;

  try {
    const ctx = await newAsyncContext();
    vm = ctx;
    const handles = new SandboxHandles();
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));
    ctx.runtime.setMemoryLimit(memoryLimitBytes);

    registerSyncHostBridge(ctx, handles);
    registerAsyncHostBridge(ctx, handles);

    const prelude = buildGuestPrelude(viewer, handles);
    const wrapped = `${prelude}\n(async () => {\n${code}\n})();`;

    const result = await evaluateWrappedCode(ctx, wrapped);

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    vm?.dispose();
  }
}