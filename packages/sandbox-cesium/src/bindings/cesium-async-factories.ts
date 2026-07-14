/**
 * The small, fixed set of genuinely async, network/Ion-backed `Cesium.*` factories
 * (imagery/terrain providers, OSM buildings, 3D Tiles, GeoJSON) that are bridged through QuickJS's
 * Asyncify mechanism rather than the generic synchronous remote-proxy bridge (see
 * `buildCesiumHostBridgeGuestPrelude` in `guest-prelude-host-bridge.ts`) — the whole point of
 * calling them is to actually wait for the real network/Ion-backed result, unlike the rest of the
 * bound API surface, which resolves once an operation *starts* rather than *completes*.
 */
import {
  Cesium3DTileset,
  CesiumTerrainProvider,
  createOsmBuildingsAsync,
  createWorldBathymetryAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
  GeoJsonDataSource,
  Model,
} from "cesium";

/**
 * The real, network/Ion-backed CesiumJS async factory/loader functions bound under the `Cesium.`
 * namespace (imagery/terrain providers, OSM buildings, 3D Tiles, GeoJSON) — pulled out into an
 * injectable seam so tests can substitute fakes instead of hitting the network or Cesium Ion.
 * Defaults to the real imports (see {@link DEFAULT_CESIUM_ASYNC_FACTORIES}); production callers
 * never need to pass this explicitly.
 */
export interface CesiumAsyncFactories {
  createWorldImageryAsync: typeof createWorldImageryAsync;
  createOsmBuildingsAsync: typeof createOsmBuildingsAsync;
  createWorldTerrainAsync: typeof createWorldTerrainAsync;
  createWorldBathymetryAsync: typeof createWorldBathymetryAsync;
  cesium3DTilesetFromUrl: typeof Cesium3DTileset.fromUrl;
  cesium3DTilesetFromIonAssetId: typeof Cesium3DTileset.fromIonAssetId;
  cesiumTerrainProviderFromIonAssetId: typeof CesiumTerrainProvider.fromIonAssetId;
  geoJsonDataSourceLoad: typeof GeoJsonDataSource.load;
  modelFromGltfAsync: typeof Model.fromGltfAsync;
}

/** The real, network-backed factories — used whenever a caller doesn't inject a fake. */
export const DEFAULT_CESIUM_ASYNC_FACTORIES: CesiumAsyncFactories = {
  createWorldImageryAsync,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  createWorldBathymetryAsync,
  cesium3DTilesetFromUrl: (...args) => Cesium3DTileset.fromUrl(...args),
  cesium3DTilesetFromIonAssetId: (...args) => Cesium3DTileset.fromIonAssetId(...args),
  cesiumTerrainProviderFromIonAssetId: (...args) => CesiumTerrainProvider.fromIonAssetId(...args),
  geoJsonDataSourceLoad: (...args) => GeoJsonDataSource.load(...args),
  modelFromGltfAsync: (...args) => Model.fromGltfAsync(...args),
};

/**
 * Names of the small, fixed set of genuinely async, network/Ion-backed `Cesium.*` factories (see
 * {@link CesiumAsyncFactories}) that are bridged through QuickJS's Asyncify mechanism rather than
 * the generic synchronous remote-proxy bridge — see {@link buildCesiumAsyncFactoryGuestPrelude}.
 */
export const CESIUM_ASYNC_FACTORY_NAMES = [
  "createWorldImageryAsync",
  "createOsmBuildingsAsync",
  "createWorldTerrainAsync",
  "createWorldBathymetryAsync",
  "cesium3DTilesetFromUrl",
  "cesium3DTilesetFromIonAssetId",
  "cesiumTerrainProviderFromIonAssetId",
  "geoJsonDataSourceLoad",
  "modelFromGltfAsync",
] as const;

/**
 * Builds the guest-side prelude declaring the genuinely async `Cesium.*` factories
 * (`createWorldImageryAsync`, `Cesium.Cesium3DTileset.fromUrl`, `Cesium.GeoJsonDataSource.load`,
 * ...) on top of the existing guest `Cesium` object (from `buildCesiumValueTypeGuestPrelude`)
 * and as bare top-level aliases, matching the same "usable both as `Cesium.x` and bare `x`"
 * convention as the value types. Unlike the rest of the bound API surface, these route through
 * QuickJS's Asyncify bridge (`__hostCallAsync__`, registered by `cesium-code-sandbox.ts`) since the
 * whole point of calling them is to actually wait for the real network/Ion-backed result — subject
 * to the "only one async CesiumJS call per script" guard enforced host-side.
 *
 * Must be evaluated after `buildCesiumValueTypeGuestPrelude` (needs `Cesium`) and
 * `buildCesiumHostBridgeGuestPrelude` (needs `__marshalArg__`/`__reviveRemoteValue__`).
 */
export function buildCesiumAsyncFactoryGuestPrelude(): string {
  return `
let __asyncCesiumCallUsed__ = false;
async function __callAsyncCesiumFactory__(name, args) {
  // This guard must run *before* ever invoking the Asyncify-backed __hostCallAsync__ a second
  // time: quickjs-emscripten's current Asyncify build has a reproducible native
  // \`free_zero_refcount\` crash the moment a second asyncified host call actually executes in a
  // script bound to a larger symbol prelude — by the time a host-side check could reject it, the
  // crash has already happened. Tracking "used" guest-side lets us throw a clean, catchable JS
  // Error instead, without ever letting the second call reach the engine's Asyncify bridge.
  if (__asyncCesiumCallUsed__) {
    throw new Error(
      "Only one async CesiumJS call (e.g. createWorldImageryAsync, GeoJsonDataSource.load) is allowed per generated script."
    );
  }
  __asyncCesiumCallUsed__ = true;
  const marshaled = args.map(__marshalArg__);
  const json = await __hostCallAsync__(name, JSON.stringify(marshaled));
  const envelope = JSON.parse(json);
  if (!envelope.ok) throw new Error(envelope.error);
  return __reviveRemoteValue__(envelope.value);
}

Cesium.createWorldImageryAsync = function (options) {
  return __callAsyncCesiumFactory__("createWorldImageryAsync", [options]);
};
Cesium.createOsmBuildingsAsync = function (options) {
  return __callAsyncCesiumFactory__("createOsmBuildingsAsync", [options]);
};
Cesium.createWorldTerrainAsync = function (options) {
  return __callAsyncCesiumFactory__("createWorldTerrainAsync", [options]);
};
Cesium.createWorldBathymetryAsync = function (options) {
  return __callAsyncCesiumFactory__("createWorldBathymetryAsync", [options]);
};
Cesium.Cesium3DTileset = {
  fromUrl: function (url, options) {
    return __callAsyncCesiumFactory__("cesium3DTilesetFromUrl", [url, options]);
  },
  fromIonAssetId: function (assetId, options) {
    return __callAsyncCesiumFactory__("cesium3DTilesetFromIonAssetId", [assetId, options]);
  },
};
Cesium.CesiumTerrainProvider = {
  fromIonAssetId: function (assetId, options) {
    return __callAsyncCesiumFactory__("cesiumTerrainProviderFromIonAssetId", [assetId, options]);
  },
};
Cesium.GeoJsonDataSource = {
  load: function (data, options) {
    return __callAsyncCesiumFactory__("geoJsonDataSourceLoad", [data, options]);
  },
};
// \`Cesium.Model\` is otherwise reached through the static-namespace fallback (see
// \`buildCesiumStaticFallbackGuestPrelude\`) for everything except \`fromGltfAsync\` — a genuinely
// async, network-backed loader real generated code commonly \`await\`s or \`.then()\`s, which (like
// the other factories here) needs the real Asyncify bridge rather than the synchronous
// remote-proxy bridge (whose handles are deliberately never thenable). Assigning this single
// method onto the SAME plain \`Cesium.Model\` object the static fallback will otherwise create on
// first access would be overwritten by that fallback, so it's special-cased directly here instead.
Cesium.Model = { fromGltfAsync: function (options) {
  return __callAsyncCesiumFactory__("modelFromGltfAsync", [options]);
} };

const createWorldImageryAsync = Cesium.createWorldImageryAsync;
const createOsmBuildingsAsync = Cesium.createOsmBuildingsAsync;
const createWorldTerrainAsync = Cesium.createWorldTerrainAsync;
const createWorldBathymetryAsync = Cesium.createWorldBathymetryAsync;
const Cesium3DTileset = Cesium.Cesium3DTileset;
const CesiumTerrainProvider = Cesium.CesiumTerrainProvider;
const GeoJsonDataSource = Cesium.GeoJsonDataSource;
const Model = Cesium.Model;
  `.trim();
}