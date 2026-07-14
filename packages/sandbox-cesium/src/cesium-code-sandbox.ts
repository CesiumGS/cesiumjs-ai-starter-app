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
  type CesiumAsyncFactories,
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
   * Overrides the real, network/Ion-backed `Cesium.*` async factories (imagery/terrain providers,
   * OSM buildings, 3D Tiles, GeoJSON) bound in `cesium-bindings.ts`. Defaults to the real
   * implementations — tests are the main intended caller of this, to avoid hitting the network or
   * Cesium Ion from a unit test.
   */
  asyncFactories?: CesiumAsyncFactories;
}

/** Shape of the JSON envelope the host bridge functions return across the host/VM boundary. */
type HostCallEnvelope = { ok: true; value: unknown } | { ok: false; error: string };

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
  const { code, viewer, timeoutMs = DEFAULT_TIMEOUT_MS, asyncFactories } = options;
  // `newAsyncContext()` itself can reject (e.g. the interpreter's WASM binary failing to load/
  // instantiate) — that must resolve to this function's documented `{ success:false, error }`
  // shape like every other failure here, not escape as an unhandled rejection. `vm` therefore
  // starts undefined and is only assigned (and only disposed in `finally`) once creation succeeds.
  let vm: Awaited<ReturnType<typeof newAsyncContext>> | undefined;

  try {
    const ctx = await newAsyncContext();
    vm = ctx;
    const handles = new SandboxHandles();
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));
    ctx.runtime.setMemoryLimit(DEFAULT_MEMORY_LIMIT_BYTES);

    function toEnvelopeString(envelope: HostCallEnvelope) {
      return ctx.newString(JSON.stringify(envelope));
    }

    // Generic synchronous remote-proxy bridge (see `buildCesiumHostBridgeGuestPrelude`): the
    // guest never enumerates a static list of bound symbols — every `viewer.*` property read/call
    // is dispatched dynamically by opaque handle id, so adding support for a new real Cesium API
    // never requires touching this marshaling layer.
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
        return toEnvelopeString({ ok: true, value: handles.wrap(value) });
      } catch (err) {
        return toEnvelopeString({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
    ctx.setProp(ctx.global, "__hostGetSync__", hostGetSyncHandle);
    hostGetSyncHandle.dispose();

    // Property-assignment counterpart to `__hostGetSync__` — real CesiumJS relies heavily on
    // plain property assignment (`tileset.style = ...`, `viewer.scene.globe.terrainProvider =
    // ...`, `entity.polygon.material = ...`) rather than setter methods, so without this the guest
    // remote proxy's `set` trap would have nothing real to forward to.
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
          return toEnvelopeString({ ok: true, value: null });
        } catch (err) {
          return toEnvelopeString({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    );
    ctx.setProp(ctx.global, "__hostSetSync__", hostSetSyncHandle);
    hostSetSyncHandle.dispose();

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
          return toEnvelopeString({ ok: true, value: handles.wrap(result ?? null) });
        } catch (err) {
          return toEnvelopeString({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    );
    ctx.setProp(ctx.global, "__hostApplySync__", hostApplySyncHandle);
    hostApplySyncHandle.dispose();

    // Constructor counterpart to `__hostApplySync__` — supports `new Cesium.SomeClass(...)` for
    // real CesiumJS classes reached through the static-namespace fallback (see
    // `buildCesiumStaticFallbackGuestPrelude`), e.g. `new Cesium.PinBuilder()`, `new
    // Cesium.WebMapServiceImageryProvider({...})`.
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
          return toEnvelopeString({ ok: true, value: handles.wrap(result ?? null) });
        } catch (err) {
          return toEnvelopeString({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    );
    ctx.setProp(ctx.global, "__hostConstructSync__", hostConstructSyncHandle);
    hostConstructSyncHandle.dispose();

    // Asyncify bridge, reserved exclusively for the small, fixed set of genuinely async
    // `Cesium.*` factories (imagery/terrain providers, 3D Tiles, GeoJSON — see
    // `buildCesiumAsyncFactoryGuestPrelude`). quickjs-emscripten's current Asyncify build has a
    // reproducible native `free_zero_refcount` crash once more than one *asyncified* host call
    // executes in a script bound to a larger symbol prelude (verified via isolated repro scripts —
    // not a bug in this module's own marshaling logic), so a second async factory call in the same
    // script is rejected explicitly here rather than risking that crash.
    const factories = asyncFactories ?? DEFAULT_CESIUM_ASYNC_FACTORIES;
    const asyncDispatch = new Map<string, (...args: unknown[]) => Promise<unknown>>([
      ["createWorldImageryAsync", factories.createWorldImageryAsync],
      ["createOsmBuildingsAsync", factories.createOsmBuildingsAsync],
      ["createWorldTerrainAsync", factories.createWorldTerrainAsync],
      ["createWorldBathymetryAsync", factories.createWorldBathymetryAsync],
      ["cesium3DTilesetFromUrl", factories.cesium3DTilesetFromUrl],
      ["cesium3DTilesetFromIonAssetId", factories.cesium3DTilesetFromIonAssetId],
      ["cesiumTerrainProviderFromIonAssetId", factories.cesiumTerrainProviderFromIonAssetId],
      ["geoJsonDataSourceLoad", factories.geoJsonDataSourceLoad],
      ["modelFromGltfAsync", factories.modelFromGltfAsync],
    ] as [string, (...args: unknown[]) => Promise<unknown>][]);
    let asyncCallCount = 0;

    const hostCallAsyncHandle = ctx.newAsyncifiedFunction(
      "__hostCallAsync__",
      async (nameHandle, argsHandle) => {
        const name = ctx.getString(nameHandle);
        const argsJson = ctx.getString(argsHandle);
        asyncCallCount += 1;
        if (asyncCallCount > 1) {
          return toEnvelopeString({
            ok: false,
            error:
              "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script.",
          });
        }

        const factory = asyncDispatch.get(name);
        if (!factory) {
          return toEnvelopeString({ ok: false, error: `Unknown async CesiumJS factory "${name}"` });
        }
        try {
          const rawArgs = JSON.parse(argsJson) as unknown[];
          const unwrapped = rawArgs.map((arg) => handles.unwrap(arg));
          const value = await factory(...unwrapped);
          return toEnvelopeString({ ok: true, value: handles.wrap(value ?? null) });
        } catch (err) {
          return toEnvelopeString({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    );
    ctx.setProp(ctx.global, "__hostCallAsync__", hostCallAsyncHandle);
    hostCallAsyncHandle.dispose();

    const viewerHandleId = handles.wrapRoot(createProxiedViewer(viewer));
    // Root handle for the real, static `Cesium` module namespace — lets the guest-side static
    // fallback proxy (see `buildCesiumStaticFallbackGuestPrelude`) reach any real CesiumJS class
    // not explicitly reimplemented as a pure guest-side value type (`Rectangle`, `Ellipsoid`,
    // `PinBuilder`, `GeoJsonPrimitive`, `Material`, `CustomShader`, ...) through the same generic,
    // dynamically-dispatched remote-proxy bridge already used for `viewer`.
    const staticCesiumHandleId = handles.wrapRoot(CesiumNamespace);
    const prelude = [
      buildCesiumValueTypeGuestPrelude(),
      buildCesiumHostBridgeGuestPrelude(),
      buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId),
      buildCesiumAsyncFactoryGuestPrelude(),
      `const viewer = __remoteProxy__(${JSON.stringify(viewerHandleId)});`,
    ].join("\n");
    const wrapped = `${prelude}\n(async () => {\n${code}\n})();`;

    const evalResult = await ctx.evalCodeAsync(wrapped);
    const promiseHandle = ctx.unwrapResult(evalResult);
    // See `code-sandbox-quickjs.ts` for why this pump is required: `resolvePromise`'s returned
    // promise only settles once QuickJS's own job queue runs the `.then` handler it attaches
    // internally, which doesn't happen automatically just by awaiting host promises.
    const settlePromise = ctx.resolvePromise(promiseHandle);
    ctx.runtime.executePendingJobs();
    const settleResult = await settlePromise;
    promiseHandle.dispose();
    const resultHandle = ctx.unwrapResult(settleResult);
    const result = ctx.dump(resultHandle);
    resultHandle.dispose();

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    vm?.dispose();
  }
}