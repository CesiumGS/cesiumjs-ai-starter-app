/**
 * The small, fixed set of genuinely async, network/Ion-backed `Cesium.*` factories
 * (imagery/terrain providers, OSM buildings, 3D Tiles, GeoJSON) that are bridged through QuickJS's
 * Asyncify mechanism rather than the generic synchronous remote-proxy bridge (see
 * `buildCesiumHostBridgeGuestPrelude` in `guest-prelude-host-bridge.ts`) — the whole point of
 * calling them is to actually wait for the real network/Ion-backed result, unlike the rest of the
 * bound API surface, which resolves once an operation *starts* rather than *completes*.
 */
import {
  ArcGISTiledElevationTerrainProvider,
  ArcGisMapServerImageryProvider,
  Cesium3DTileset,
  CesiumTerrainProvider,
  createOsmBuildingsAsync,
  createWorldBathymetryAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
  GeoJsonDataSource,
  Model,
} from "cesium";
import { extractFunctionBody } from "./function-source.js";
import { CESIUM_ASYNC_BINDING_NAMES } from "./capabilities-registry.js";

/**
 * The real, network/Ion-backed CesiumJS async factory/loader functions bound under the `Cesium.`
 * namespace (imagery/terrain providers, OSM buildings, 3D Tiles, GeoJSON). Keeping them in one
 * registry lets the host bridge derive its dispatch map directly; tests mock the `cesium` module
 * exports when they need to avoid the network or Cesium Ion.
 */
export interface CesiumAsyncFactories {
  createWorldImageryAsync: typeof createWorldImageryAsync;
  createOsmBuildingsAsync: typeof createOsmBuildingsAsync;
  createWorldTerrainAsync: typeof createWorldTerrainAsync;
  createWorldBathymetryAsync: typeof createWorldBathymetryAsync;
  cesium3DTilesetFromUrl: typeof Cesium3DTileset.fromUrl;
  cesium3DTilesetFromIonAssetId: typeof Cesium3DTileset.fromIonAssetId;
  cesiumTerrainProviderFromIonAssetId: typeof CesiumTerrainProvider.fromIonAssetId;
  arcGisTiledElevationTerrainProviderFromUrl: typeof ArcGISTiledElevationTerrainProvider.fromUrl;
  arcGisMapServerImageryProviderFromUrl: typeof ArcGisMapServerImageryProvider.fromUrl;
  geoJsonDataSourceLoad: typeof GeoJsonDataSource.load;
  modelFromGltfAsync: typeof Model.fromGltfAsync;
}

/** The real, network-backed factories used by the host bridge. */
export const DEFAULT_CESIUM_ASYNC_FACTORIES: CesiumAsyncFactories = {
  createWorldImageryAsync,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  createWorldBathymetryAsync,
  cesium3DTilesetFromUrl: (...args) => Cesium3DTileset.fromUrl(...args),
  cesium3DTilesetFromIonAssetId: (...args) => Cesium3DTileset.fromIonAssetId(...args),
  cesiumTerrainProviderFromIonAssetId: (...args) => CesiumTerrainProvider.fromIonAssetId(...args),
  arcGisTiledElevationTerrainProviderFromUrl: (...args) =>
    ArcGISTiledElevationTerrainProvider.fromUrl(...args),
  arcGisMapServerImageryProviderFromUrl: (...args) =>
    ArcGisMapServerImageryProvider.fromUrl(...args),
  geoJsonDataSourceLoad: (...args) => GeoJsonDataSource.load(...args),
  modelFromGltfAsync: (...args) => Model.fromGltfAsync(...args),
};

/**
 * Names of the small, fixed set of genuinely async, network/Ion-backed `Cesium.*` factories (see
 * {@link CesiumAsyncFactories}) that are bridged through QuickJS's Asyncify mechanism rather than
 * the generic synchronous remote-proxy bridge — see {@link buildCesiumAsyncFactoryGuestPrelude}.
 */
export const CESIUM_ASYNC_FACTORY_NAMES = CESIUM_ASYNC_BINDING_NAMES.filter(
  (name) => !name.startsWith("viewer"),
);

/**
 * Builds the guest-side prelude declaring the genuinely async `Cesium.*` factories
 * (`createWorldImageryAsync`, `Cesium.Cesium3DTileset.fromUrl`, `Cesium.GeoJsonDataSource.load`,
 * ...) on top of the existing guest `Cesium` object (from `buildCesiumValueTypeGuestPrelude`)
 * and as bare top-level aliases, matching the same "usable both as `Cesium.x` and bare `x`"
 * convention as the value types. Unlike the rest of the bound API surface, these route through
 * QuickJS's Asyncify bridge (`__cesiumSandboxHostCallAsync__` — this package's own global, not a
 * QuickJS built-in — registered by `host-bridge.ts`) since the
 * whole point of calling them is to actually wait for the real network/Ion-backed result — subject
 * to the "only one async CesiumJS call per script" guard enforced host-side.
 *
 * Must be evaluated after `buildCesiumValueTypeGuestPrelude` (needs `Cesium`),
 * `buildCesiumHostBridgeGuestPrelude` (needs `__marshalArg__`/`__reviveRemoteValue__`), and
 * `buildCesiumStaticFallbackGuestPrelude` (needs `__staticCesium__`, used so the curated
 * `Cesium.<Class>` stubs this prelude assigns still fall back to the real class for any member
 * without a dedicated Asyncify binding — see `__curatedNamespaceStub__` below).
 */
// Ambient shims for guest-only globals `guestAsyncFactoryBody` references: all declared by
// preludes evaluated earlier (`guest-prelude-value-types.ts`'s `Cesium`, `guest-prelude-host-
// bridge.ts`'s `__marshalArg__`/`__reviveRemoteValue__`, and `__cesiumSandboxHostCallAsync__`,
// registered host-side by `host-bridge.ts`). None of these `declare`s emit any JS or appear in the
// extracted text — they exist purely so this file's guest-side logic can be written as a real,
// type-checked function instead of an opaque template-literal string.
declare let Cesium: any;
declare const __staticCesium__: any;
declare function __marshalArg__(value: any): unknown;
declare function __reviveRemoteValue__(value: any): unknown;
declare function __cesiumSandboxHostCallAsync__(name: string, argsJson: string): Promise<string>;

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the genuinely async `Cesium.*` factory bindings described in
 * this file's top-level doc comment.
 */
function guestAsyncFactoryBody(): void {
  let __asyncCesiumCallUsed__ = false;
  async function __callAsyncCesiumFactory__(name: string, args: any[]): Promise<unknown> {
    // This guard must run *before* ever invoking the Asyncify-backed __cesiumSandboxHostCallAsync__ a second
    // time: quickjs-emscripten's current Asyncify build has a reproducible native
    // `free_zero_refcount` crash the moment a second asyncified host call actually executes in a
    // script bound to a larger symbol prelude — by the time a host-side check could reject it,
    // the crash has already happened. Tracking "used" guest-side lets us throw a clean,
    // catchable JS Error instead, without ever letting the second call reach the engine's
    // Asyncify bridge.
    if (__asyncCesiumCallUsed__) {
      throw new Error(
        "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script.",
      );
    }
    __asyncCesiumCallUsed__ = true;
    const marshaled = args.map(__marshalArg__);
    const json = await __cesiumSandboxHostCallAsync__(name, JSON.stringify(marshaled));
    const envelope = JSON.parse(json);
    if (!envelope.ok) throw new Error(envelope.error);
    return __reviveRemoteValue__(envelope.value);
  }

  // Wraps a small set of curated, Asyncify-backed methods (e.g. `fromUrl`) in a `Proxy` keyed by
  // `cesiumClassName`, so assigning the result to `Cesium.<cesiumClassName>` (see below) only ever
  // *adds* those methods rather than *replacing* the class outright. Every other member (static
  // properties, or methods with no curated async binding of their own, e.g. `fromBasemapType`,
  // `pickFeatures`) still reaches the real class through the static-namespace fallback bridge
  // (`__staticCesium__`, from `buildCesiumStaticFallbackGuestPrelude`, evaluated before this
  // prelude) via the generic dynamic-Promise bridge instead of being silently lost.
  function __curatedNamespaceStub__(cesiumClassName: string, curatedMethods: Record<string, unknown>) {
    return new Proxy(curatedMethods, {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return __staticCesium__[cesiumClassName][prop];
      },
    });
  }

  Cesium.createWorldImageryAsync = function (options: any) {
    return __callAsyncCesiumFactory__("createWorldImageryAsync", [options]);
  };
  Cesium.createOsmBuildingsAsync = function (options: any) {
    return __callAsyncCesiumFactory__("createOsmBuildingsAsync", [options]);
  };
  Cesium.createWorldTerrainAsync = function (options: any) {
    return __callAsyncCesiumFactory__("createWorldTerrainAsync", [options]);
  };
  Cesium.createWorldBathymetryAsync = function (options: any) {
    return __callAsyncCesiumFactory__("createWorldBathymetryAsync", [options]);
  };
  Cesium.Cesium3DTileset = __curatedNamespaceStub__("Cesium3DTileset", {
    fromUrl: function (url: string, options: any) {
      return __callAsyncCesiumFactory__("cesium3DTilesetFromUrl", [url, options]);
    },
    fromIonAssetId: function (assetId: number, options: any) {
      return __callAsyncCesiumFactory__("cesium3DTilesetFromIonAssetId", [assetId, options]);
    },
  });
  Cesium.CesiumTerrainProvider = __curatedNamespaceStub__("CesiumTerrainProvider", {
    fromIonAssetId: function (assetId: number, options: any) {
      return __callAsyncCesiumFactory__("cesiumTerrainProviderFromIonAssetId", [assetId, options]);
    },
  });
  Cesium.ArcGISTiledElevationTerrainProvider = __curatedNamespaceStub__(
    "ArcGISTiledElevationTerrainProvider",
    {
      fromUrl: function (url: string, options: any) {
        return __callAsyncCesiumFactory__("arcGisTiledElevationTerrainProviderFromUrl", [
          url,
          options,
        ]);
      },
    },
  );
  Cesium.ArcGisMapServerImageryProvider = __curatedNamespaceStub__("ArcGisMapServerImageryProvider", {
    fromUrl: function (url: string, options: any) {
      return __callAsyncCesiumFactory__("arcGisMapServerImageryProviderFromUrl", [url, options]);
    },
  });
  Cesium.GeoJsonDataSource = __curatedNamespaceStub__("GeoJsonDataSource", {
    load: function (data: unknown, options: any) {
      return __callAsyncCesiumFactory__("geoJsonDataSourceLoad", [data, options]);
    },
  });
  // `fromGltfAsync` is a genuinely async, network-backed loader real generated code commonly
  // `await`s or `.then()`s, so (like the other factories here) it needs the real Asyncify bridge
  // rather than the synchronous remote-proxy bridge (whose handles are deliberately never
  // thenable). Every other `Cesium.Model` member still reaches the real class through the static-
  // namespace fallback, via `__curatedNamespaceStub__`.
  Cesium.Model = __curatedNamespaceStub__("Model", {
    fromGltfAsync: function (options: any) {
      return __callAsyncCesiumFactory__("modelFromGltfAsync", [options]);
    },
  });
}

// The bare top-level aliases (`createWorldImageryAsync`, `Cesium3DTileset`, ...) are appended as
// plain literal text rather than declared inside `guestAsyncFactoryBody`: this file's own
// top-level `cesium` package imports happen to share these exact names (needed elsewhere in this
// file for `DEFAULT_CESIUM_ASYNC_FACTORIES`), and declaring same-named shadowing locals inside a
// real, compiled function is unsafe here — some transpilers (e.g. esbuild, which Vitest uses to
// run `.ts` sources directly) rename shadowing locals to avoid ambiguity with the outer import,
// silently corrupting the text `Function.prototype.toString()` recovers at runtime.
const GUEST_BARE_ALIASES = `
const createWorldImageryAsync = Cesium.createWorldImageryAsync;
const createOsmBuildingsAsync = Cesium.createOsmBuildingsAsync;
const createWorldTerrainAsync = Cesium.createWorldTerrainAsync;
const createWorldBathymetryAsync = Cesium.createWorldBathymetryAsync;
const Cesium3DTileset = Cesium.Cesium3DTileset;
const CesiumTerrainProvider = Cesium.CesiumTerrainProvider;
const ArcGISTiledElevationTerrainProvider = Cesium.ArcGISTiledElevationTerrainProvider;
const GeoJsonDataSource = Cesium.GeoJsonDataSource;
const Model = Cesium.Model;
`.trim();

export function buildCesiumAsyncFactoryGuestPrelude(): string {
  return [extractFunctionBody(guestAsyncFactoryBody), GUEST_BARE_ALIASES].join("\n");
}
