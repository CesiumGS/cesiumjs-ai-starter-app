import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ArcGISTiledElevationTerrainProvider,
  ArcGisMapServerImageryProvider,
  BingMapsImageryProvider,
  Cartesian3,
  Cesium3DTilesTerrainProvider,
  Cesium3DTilesVoxelProvider,
  Cesium3DTileset,
  Cesium3DTileStyle,
  CesiumTerrainProvider,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync,
  createWorldBathymetryAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
  CzmlDataSource,
  exportKml,
  GeoJsonDataSource,
  GeoJsonPrimitive,
  Google2DImageryProvider,
  GoogleEarthEnterpriseMapsProvider,
  GoogleEarthEnterpriseMetadata,
  GoogleStreetViewCubeMapPanoramaProvider,
  GpxDataSource,
  I3SDataProvider,
  ImageryProvider,
  IonImageryProvider,
  ITwinData,
  KmlDataSource,
  Material,
  Model,
  Resource,
  sampleTerrain,
  sampleTerrainMostDetailed,
  SingleTileImageryProvider,
  TileMapServiceImageryProvider,
  VRTheWorldTerrainProvider,
} from "cesium";
import {
  CESIUM_DYNAMIC_PROMISE_RUNTIME_COVERAGE,
  CESIUM_DYNAMIC_PROMISE_RUNTIME_GAPS,
} from "./bindings/capabilities-registry.js";
import { runCesiumCodeInSandbox } from "./cesium-code-sandbox.js";

/**
 * Exercises the real-primitive QuickJS sandbox end-to-end: unlike the fixed-capability sandbox
 * (`code-sandbox-quickjs.test.ts`), the generated `code` here composes bound CesiumJS primitives
 * itself (`Cesium.Cartesian3.fromDegrees`, `viewer.camera.flyTo`, `viewer.entities.add`) rather
 * than calling one pre-implemented, per-intent capability function — proving the LLM is the one
 * writing the CesiumJS logic, not the frontend.
 *
 * The genuinely async, network/Ion-backed `Cesium.*` factories (`createWorldImageryAsync`,
 * `Cesium3DTileset.fromUrl`, ...) are mocked at the module level below (`vi.mock("cesium", ...)`)
 * so these tests never hit the real network or Cesium Ion — `runCesiumCodeInSandbox` itself has
 * no test-only injection seam for this; it always binds the real `cesium` module's exports, so
 * mocking that module is the only way to intercept them.
 */

vi.mock("cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("cesium")>();
  return {
    ...actual,
    createWorldImageryAsync: vi.fn(async (options?: unknown) => ({
      kind: "imageryProvider",
      options,
    })),
    createOsmBuildingsAsync: vi.fn(async (options?: unknown) => ({
      kind: "osmBuildingsTileset",
      options,
    })),
    createWorldTerrainAsync: vi.fn(async (options?: unknown) => ({
      kind: "terrainProvider",
      options,
    })),
    createWorldBathymetryAsync: vi.fn(async (options?: unknown) => ({
      kind: "bathymetryProvider",
      options,
    })),
    Cesium3DTileset: {
      ...actual.Cesium3DTileset,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "tileset",
        url,
        options,
      })),
      fromIonAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "tileset",
        assetId,
        options,
      })),
      // `loadJson` is a *static* method (not an instance method), so this exercises the
      // static-namespace fallback + generic dynamic Promise bridge, same as `fromUrl`/
      // `fromIonAssetId` above.
      loadJson: vi.fn(async (tilesetUrl: unknown) => ({ kind: "tilesetJson", tilesetUrl })),
    },
    CesiumTerrainProvider: {
      ...actual.CesiumTerrainProvider,
      fromIonAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "terrainProvider",
        assetId,
        options,
      })),
      // `fromUrl` is a "declaration-only" dynamic Promise candidate per `CESIUM_COMPATIBILITY.md`,
      // reached only through the generic static-namespace fallback + dynamic Promise bridge (same
      // mechanism as `FakeCesiumTerrainProvider`'s instance methods below).
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "terrainProvider",
        url,
        options,
      })),
    },
    ArcGISTiledElevationTerrainProvider: {
      ...actual.ArcGISTiledElevationTerrainProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "terrainProvider",
        url,
        options,
      })),
    },
    GeoJsonDataSource: {
      ...actual.GeoJsonDataSource,
      load: vi.fn(async (data: unknown, options?: unknown) => ({
        kind: "dataSource",
        data,
        options,
      })),
    },
    Model: {
      ...actual.Model,
      fromGltfAsync: vi.fn(async (options?: unknown) => ({ kind: "model", options })),
    },
    Cesium3DTilesVoxelProvider: {
      ...actual.Cesium3DTilesVoxelProvider,
      // "Declaration-only" dynamic Promise candidate per `CESIUM_COMPATIBILITY.md`, reached only
      // through the generic static-namespace fallback + dynamic Promise bridge.
      fromUrl: vi.fn(async (url: unknown) => ({ kind: "voxelProvider", url })),
    },
    Cesium3DTilesTerrainProvider: {
      ...actual.Cesium3DTilesTerrainProvider,
      // Both static factories are "declaration-only" dynamic Promise candidates per
      // `CESIUM_COMPATIBILITY.md`, reached only through the generic static-namespace fallback +
      // dynamic Promise bridge.
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "cesium3DTilesTerrainProvider",
        url,
        options,
      })),
      fromIonAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "cesium3DTilesTerrainProvider",
        assetId,
        options,
      })),
    },
    ImageryProvider: {
      ...actual.ImageryProvider,
      // `loadImage` is a static factory, so this exercises the static-namespace fallback +
      // generic dynamic Promise bridge. The `imageryProvider` argument is intentionally left out
      // of the resolved value (unlike the `url`) to avoid round-tripping a live class-instance
      // handle back through the bridge, matching every other mock below.
      loadImage: vi.fn(async (_imageryProvider: unknown, url: unknown) => ({
        kind: "imageryImage",
        url,
      })),
    },
    IonImageryProvider: {
      ...actual.IonImageryProvider,
      // "Declaration-only" dynamic Promise candidate per `CESIUM_COMPATIBILITY.md` (same pattern as
      // `Cesium3DTilesVoxelProvider.fromUrl` above).
      fromAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "ionImageryProvider",
        assetId,
        options,
      })),
    },
    // The classes below only need their *static* factories mocked here — each one's
    // Promise-returning *instance* methods (e.g. `requestImage`/`pickFeatures`/`geocode`) are
    // exercised separately via an independent `Fake*` class hung off the synthetic
    // `viewer.testHandles` object in `fakeViewer()` below, not through this module mock at all
    // (mirroring `ArcGisMapServerImageryProvider`: its `pickFeatures`/`requestImage` are already
    // tested that way above, entirely decoupled from its static factories mocked below).
    ArcGisMapServerImageryProvider: {
      ...actual.ArcGisMapServerImageryProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "arcGisMapServerImageryProvider",
        url,
        options,
      })),
      fromBasemapType: vi.fn(async (style: unknown, options?: unknown) => ({
        kind: "arcGisMapServerImageryProvider",
        style,
        options,
      })),
    },
    Material: {
      ...actual.Material,
      fromTypeAsync: vi.fn(async (type: unknown, options?: unknown) => ({
        kind: "material",
        type,
        options,
      })),
    },
    GeoJsonPrimitive: {
      ...actual.GeoJsonPrimitive,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "geoJsonPrimitive",
        url,
        options,
      })),
    },
    GoogleEarthEnterpriseMetadata: {
      ...actual.GoogleEarthEnterpriseMetadata,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "googleEarthEnterpriseMetadata",
        url,
        options,
      })),
    },
    GoogleStreetViewCubeMapPanoramaProvider: {
      ...actual.GoogleStreetViewCubeMapPanoramaProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "googleStreetViewCubeMapPanoramaProvider",
        url,
        options,
      })),
    },
    TileMapServiceImageryProvider: {
      ...actual.TileMapServiceImageryProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "tileMapServiceImageryProvider",
        url,
        options,
      })),
    },
    CzmlDataSource: {
      ...actual.CzmlDataSource,
      load: vi.fn(async (data: unknown, options?: unknown) => ({
        kind: "dataSource",
        data,
        options,
      })),
    },
    GpxDataSource: {
      ...actual.GpxDataSource,
      load: vi.fn(async (data: unknown, options?: unknown) => ({
        kind: "dataSource",
        data,
        options,
      })),
    },
    KmlDataSource: {
      ...actual.KmlDataSource,
      load: vi.fn(async (data: unknown, options?: unknown) => ({
        kind: "dataSource",
        data,
        options,
      })),
    },
    BingMapsImageryProvider: {
      ...actual.BingMapsImageryProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "bingMapsImageryProvider",
        url,
        options,
      })),
    },
    Google2DImageryProvider: {
      ...actual.Google2DImageryProvider,
      fromIonAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "google2DImageryProvider",
        assetId,
        options,
      })),
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "google2DImageryProvider",
        url,
        options,
      })),
    },
    GoogleEarthEnterpriseMapsProvider: {
      ...actual.GoogleEarthEnterpriseMapsProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "googleEarthEnterpriseMapsProvider",
        url,
        options,
      })),
    },
    SingleTileImageryProvider: {
      ...actual.SingleTileImageryProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "singleTileImageryProvider",
        url,
        options,
      })),
    },
    VRTheWorldTerrainProvider: {
      ...actual.VRTheWorldTerrainProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "vrTheWorldTerrainProvider",
        url,
        options,
      })),
    },
    I3SDataProvider: {
      ...actual.I3SDataProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "i3sDataProvider",
        url,
        options,
      })),
    },
    ITwinData: {
      ...actual.ITwinData,
      createDataSourceForRealityDataId: vi.fn(async (options?: unknown) => ({
        kind: "iTwinDataSource",
        options,
      })),
      createTilesetForRealityDataId: vi.fn(async (options?: unknown) => ({
        kind: "iTwinTileset",
        options,
      })),
      createTilesetFromIModelId: vi.fn(async (options?: unknown) => ({
        kind: "iTwinTileset",
        options,
      })),
      loadGeospatialFeatures: vi.fn(async (options?: unknown) => ({
        kind: "iTwinGeospatialFeatures",
        options,
      })),
    },
    // Bare top-level functions (not class static members) — each needs its own name in
    // a non-blocked top-level export (like a class name) so the static namespace fallback proxy
    // (`guest-prelude-static-fallback.ts`) exposes `Cesium.<name>`, reached the same way as
    // `createWorldImageryAsync`/`createOsmBuildingsAsync` above.
    exportKml: vi.fn(async (options?: unknown) => ({ kind: "kmlExport", options })),
    sampleTerrain: vi.fn(async (terrainProvider: unknown, level: unknown, positions: unknown) => ({
      kind: "sampledPositions",
      terrainProvider,
      level,
      positions,
    })),
    sampleTerrainMostDetailed: vi.fn(async (terrainProvider: unknown, positions: unknown) => ({
      kind: "sampledPositions",
      terrainProvider,
      positions,
    })),
    createGooglePhotorealistic3DTileset: vi.fn(async (apiOptions?: unknown) => ({
      kind: "tileset",
      apiOptions,
    })),
  };
});

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `CesiumTerrainProvider` instance — the kind of live object
// `Cesium.CesiumTerrainProvider.fromUrl(...)`/`.fromIonAssetId(...)` resolve to.
// `requestTileGeometry`/`loadTileDataAvailability` are genuinely Promise-returning instance
// methods with no named async binding, so calling them on an already-reachable handle
// (`viewer.scene.globe.terrainProvider`) exercises the generic dynamic Promise bridge exactly
// like `ArcGISTiledElevationTerrainProvider.requestTileGeometry` below.
class FakeCesiumTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
  // Mirrors the real API's `Promise<void>` return type.
  loadTileDataAvailability = vi.fn(async (_x: number, _y: number, _level: number) => undefined);
}

// A minimal class (not a plain `{}` object literal) standing in for real Cesium's `Globe` class
// instance — `SandboxHandles.isPlainData` distinguishes a real class instance (opaque handle,
// correctly proxied for property assignment) from inert plain JSON data (flattened to a
// snapshot), and every real CesiumJS class instance has a non-`Object.prototype` prototype.
// `terrainProvider` defaults to a `FakeCesiumTerrainProvider` so its dynamic-bridge instance
// methods are reachable without every test needing to assign one first.
class FakeGlobe {
  terrainProvider: unknown = new FakeCesiumTerrainProvider();
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `ArcGISTiledElevationTerrainProvider` instance — the kind
// of live object `Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(...)` resolves to. Its
// `requestTileGeometry` is a genuinely Promise-returning instance method with no named async
// binding, so calling it on an already-reachable handle (`viewer.terrainProvider`) exercises the
// generic dynamic Promise bridge exactly like `DataSourceCollection.add`/`Scene.
// sampleHeightMostDetailed` below.
class FakeArcGISTiledElevationTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `ArcGisMapServerImageryProvider` instance reached via
// `viewer.imageryLayers.get(index).imageryProvider` — `requestImage`/`pickFeatures` are genuinely
// Promise-returning instance methods with no named async binding (real Cesium's fromUrl/
// fromBasemapType construct the provider, but the provider's own instance methods are only ever
// reached afterward), so calling them on an already-reachable handle exercises the generic
// dynamic Promise bridge exactly like `ArcGISTiledElevationTerrainProvider.requestTileGeometry`.
class FakeArcGisMapServerImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a generic `ImageryProvider` base-class instance reached via
// `viewer.imageryLayers.get(1).imageryProvider` — a second, distinct imagery layer slot from
// `FakeArcGisMapServerImageryProvider`'s (index 0), since `ImageryProvider.pickFeatures`/
// `requestImage` are separate declaration paths in `CESIUM_COMPATIBILITY.md` from the
// concrete-provider overrides already covered above. Also used as the `imageryProvider` argument
// for the static `ImageryProvider.loadImage(imageryProvider, url)` factory.
class FakeImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `IonImageryProvider` instance reached via
// `viewer.imageryLayers.get(2).imageryProvider` — a third, distinct imagery layer slot, since
// `IonImageryProvider.pickFeatures`/`requestImage` are their own declaration paths in
// `CESIUM_COMPATIBILITY.md`, reached only after `IonImageryProvider.fromAssetId` above
// constructs the provider.
class FakeIonImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

// A minimal class standing in for a real `IonGeocoderService` instance. Unlike the imagery/
// terrain fakes above, there's no public `Viewer` property that exposes a raw geocoder service
// instance (the real `viewer.geocoder` is a `GeocoderViewModel` wrapper, not the service itself),
// so `fakeViewer()` attaches this directly as `viewer.geocoderService` — a synthetic but
// convenient reachable handle for exercising `geocode`, a genuinely Promise-returning instance
// method with no named async binding.
class FakeIonGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `Cesium3DTilesVoxelProvider` instance reached via
// `viewer.scene.primitives.get(index).provider` — the same object graph real generated code uses
// (`new VoxelPrimitive({ provider })`, then `scene.primitives.add(...)`). `requestData` is a
// genuinely Promise-returning instance method with no named async binding, so calling it on an
// already-reachable handle exercises the generic dynamic Promise bridge exactly like
// `CesiumTerrainProvider.requestTileGeometry` above.
class FakeCesium3DTilesVoxelProvider {
  requestData = vi.fn(
    async (options?: { tileLevel?: number; tileX?: number; tileY?: number; tileZ?: number }) => ({
      kind: "voxelContent",
      ...options,
    }),
  );
}

// A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
// `FakeGlobe`) standing in for a real `Cesium3DTilesTerrainProvider` instance reached via
// `viewer.scene.terrainProvider` — a real, settable property distinct from
// `viewer.scene.globe.terrainProvider` (already `FakeCesiumTerrainProvider`'s slot) and
// `viewer.terrainProvider` (already `FakeArcGISTiledElevationTerrainProvider`'s slot).
// `requestTileGeometry`/`loadTileDataAvailability` are genuinely Promise-returning instance
// methods with no named async binding, so calling them on this already-reachable handle
// exercises the generic dynamic Promise bridge exactly like `CesiumTerrainProvider` above.
class FakeCesium3DTilesTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "cesium3DTilesTerrainData",
    x,
    y,
    level,
  }));
  // Mirrors the real API's `Promise<void>` return type.
  loadTileDataAvailability = vi.fn(async (_x: number, _y: number, _level: number) => undefined);
}

// ---------------------------------------------------------------------------------------------
// The `Fake*` classes below back `viewer.testHandles` (see `fakeViewer()`), a synthetic grab-bag
// of reachable instances for real CesiumJS classes that have no natural Viewer/Scene property to
// hang off of (unlike `scene.globe.terrainProvider`, `imageryLayers.get(index)`, ...) — the same
// "synthetic but convenient reachable handle" precedent as `viewer.geocoderService` above.
// Each real class here does have a *public* constructor (verified against `Cesium.d.ts`), so an
// alternative would be constructing it directly in guest code (`new Cesium.X(...)`), but that
// would require the "cesium" module mock's `X` export to be a real, shared-identity class rather
// than the plain object-literal static-factory overrides used above (and below, for the several
// of these classes that also have a mocked static factory) — keeping instance construction here,
// entirely test-side, avoids that split and matches how `FakeArcGisMapServerImageryProvider`
// above is already fully decoupled from `ArcGisMapServerImageryProvider`'s own `fromUrl` mock.
// ---------------------------------------------------------------------------------------------

class FakeAzure2DImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeBingMapsImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeGoogle2DImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeGoogleEarthEnterpriseImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeGoogleEarthEnterpriseMapsProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeGridImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeMapboxImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

class FakeMapboxStyleImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

class FakeSingleTileImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeTileCoordinatesImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

class FakeUrlTemplateImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

class FakeWebMapServiceImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

class FakeWebMapTileServiceImageryProvider {
  requestImage = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
  pickFeatures = vi.fn(
    async (x: number, y: number, level: number, longitude: number, latitude: number) => [
      { kind: "featureInfo", x, y, level, longitude, latitude },
    ],
  );
}

class FakeVRTheWorldTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
  loadTileDataAvailability = vi.fn(async (_x: number, _y: number, _level: number) => undefined);
}

class FakeEllipsoidTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
}

class FakeCustomHeightmapTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
  loadTileDataAvailability = vi.fn(async (_x: number, _y: number, _level: number) => undefined);
}

class FakeGoogleEarthEnterpriseTerrainProvider {
  requestTileGeometry = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "terrainData",
    x,
    y,
    level,
  }));
}

// `upsample` is a `TerrainData` subclass instance method (real signature:
// `Promise<TerrainData> | undefined`) normally reached from a prior `requestTileGeometry` call's
// resolved value — but each class below is instead reached directly via its own `testHandles`
// slot for a deterministic, self-contained test double, matching every other class on this page.
class FakeCesium3DTilesTerrainData {
  upsample = vi.fn(
    async (
      _tilingScheme: unknown,
      thisX: number,
      thisY: number,
      thisLevel: number,
      descendantX: number,
      descendantY: number,
      descendantLevel: number,
    ) => ({
      kind: "cesium3DTilesTerrainData",
      thisX,
      thisY,
      thisLevel,
      descendantX,
      descendantY,
      descendantLevel,
    }),
  );
}

class FakeGoogleEarthEnterpriseTerrainData {
  upsample = vi.fn(
    async (
      _tilingScheme: unknown,
      thisX: number,
      thisY: number,
      thisLevel: number,
      descendantX: number,
      descendantY: number,
      descendantLevel: number,
    ) => ({
      kind: "googleEarthEnterpriseTerrainData",
      thisX,
      thisY,
      thisLevel,
      descendantX,
      descendantY,
      descendantLevel,
    }),
  );
}

class FakeHeightmapTerrainData {
  upsample = vi.fn(
    async (
      _tilingScheme: unknown,
      thisX: number,
      thisY: number,
      thisLevel: number,
      descendantX: number,
      descendantY: number,
      descendantLevel: number,
    ) => ({
      kind: "heightmapTerrainData",
      thisX,
      thisY,
      thisLevel,
      descendantX,
      descendantY,
      descendantLevel,
    }),
  );
}

class FakeQuantizedMeshTerrainData {
  upsample = vi.fn(
    async (
      _tilingScheme: unknown,
      thisX: number,
      thisY: number,
      thisLevel: number,
      descendantX: number,
      descendantY: number,
      descendantLevel: number,
    ) => ({
      kind: "quantizedMeshTerrainData",
      thisX,
      thisY,
      thisLevel,
      descendantX,
      descendantY,
      descendantLevel,
    }),
  );
}

// Geocoder services besides `IonGeocoderService` (already covered above via the synthetic
// `viewer.geocoderService` handle) — each real class has a public constructor, but for the same
// reason as the imagery/terrain fakes above, its `geocode` mock lives on an independent
// `testHandles` instance rather than a `new Cesium.X(...)` constructed inside the guest script.
class FakeBingMapsGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

class FakeCartographicGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

class FakeGoogleGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

class FakeOpenCageGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

class FakePeliasGeocoderService {
  geocode = vi.fn(async (query: string, type?: unknown) => [
    { kind: "geocodeResult", query, type },
  ]);
}

// `I3SDataProvider.fromUrl` is mocked separately above (module-level static factory); this fake
// backs `filterByAttributes`, a genuinely Promise-returning instance method with no named async
// binding.
class FakeI3SDataProvider {
  filterByAttributes = vi.fn(async (_filters?: unknown) => undefined);
}

class FakeI3SField {
  load = vi.fn(async () => undefined);
}

class FakeI3SLayer {
  filterByAttributes = vi.fn(async (_filters?: unknown) => undefined);
}

class FakeI3SNode {
  loadField = vi.fn(async (_name: string) => undefined);
  loadFields = vi.fn(async () => undefined);
}

// `PinBuilder` is not denylisted (the real class currently passes through unmocked), but
// its `fromMakiIconId`/`fromUrl` instance methods would otherwise issue real network requests for
// Maki icon/image assets, so this fake stands in for a constructed `new Cesium.PinBuilder()`.
class FakePinBuilder {
  fromMakiIconId = vi.fn(async (id: string, color?: unknown) => ({ kind: "pinCanvas", id, color }));
  fromUrl = vi.fn(async (url: unknown, color?: unknown, size?: unknown) => ({
    kind: "pinCanvas",
    url,
    color,
    size,
  }));
}

class FakeTimeDynamicImagery {
  getFromCache = vi.fn(async (x: number, y: number, level: number) => ({
    kind: "imageryTile",
    x,
    y,
    level,
  }));
}

// `CzmlDataSource.load`/`GeoJsonDataSource.process` are mocked/covered separately above; these
// back the sibling instance method with no named async binding on each class.
class FakeCzmlDataSourceInstance {
  process = vi.fn(async (data: unknown, options?: unknown) => ({
    kind: "dataSource",
    data,
    options,
  }));
}

class FakeGeoJsonDataSourceInstance {
  process = vi.fn(async (data: unknown, options?: unknown) => ({
    kind: "dataSource",
    data,
    options,
  }));
}

function fakeViewer() {
  const entitiesById = new Map<string, unknown>();
  let nextId = 0;
  // Created once per `fakeViewer()` call (not inside `get`'s callback) so every call to
  // `imageryLayers.get(0)` \u2014 both from generated code and from a test's later assertion \u2014
  // resolves to the SAME fake layer/provider instance, matching the existing `terrainProvider`
  // pattern above.
  const arcGisImageryLayer = {
    imageryProvider: new FakeArcGisMapServerImageryProvider() as unknown,
  };
  // Distinct imagery layer slots (indexes 1 and 2) for the generic `ImageryProvider` base-class
  // and `IonImageryProvider` fakes, kept separate from `arcGisImageryLayer` (index 0) above.
  const genericImageryLayer = { imageryProvider: new FakeImageryProvider() as unknown };
  const ionImageryLayer = { imageryProvider: new FakeIonImageryProvider() as unknown };
  // Same reasoning, for `scene.primitives.get(0).provider` — stands in for a real `VoxelPrimitive`
  // holding a `Cesium3DTilesVoxelProvider`.
  const voxelPrimitive = { provider: new FakeCesium3DTilesVoxelProvider() as unknown };

  return {
    // A synthetic, non-real-API grab-bag of reachable instances for classes with no natural
    // Viewer/Scene property to attach to — the same precedent as `geocoderService` below, just
    // consolidated into one place since there are so many of them (see the `Fake*` classes'
    // shared doc comment above `fakeViewer()`).
    testHandles: {
      azure2DImageryProvider: new FakeAzure2DImageryProvider() as unknown,
      bingMapsImageryProvider: new FakeBingMapsImageryProvider() as unknown,
      google2DImageryProvider: new FakeGoogle2DImageryProvider() as unknown,
      googleEarthEnterpriseImageryProvider:
        new FakeGoogleEarthEnterpriseImageryProvider() as unknown,
      googleEarthEnterpriseMapsProvider: new FakeGoogleEarthEnterpriseMapsProvider() as unknown,
      gridImageryProvider: new FakeGridImageryProvider() as unknown,
      mapboxImageryProvider: new FakeMapboxImageryProvider() as unknown,
      mapboxStyleImageryProvider: new FakeMapboxStyleImageryProvider() as unknown,
      singleTileImageryProvider: new FakeSingleTileImageryProvider() as unknown,
      tileCoordinatesImageryProvider: new FakeTileCoordinatesImageryProvider() as unknown,
      urlTemplateImageryProvider: new FakeUrlTemplateImageryProvider() as unknown,
      webMapServiceImageryProvider: new FakeWebMapServiceImageryProvider() as unknown,
      webMapTileServiceImageryProvider: new FakeWebMapTileServiceImageryProvider() as unknown,
      vrTheWorldTerrainProvider: new FakeVRTheWorldTerrainProvider() as unknown,
      ellipsoidTerrainProvider: new FakeEllipsoidTerrainProvider() as unknown,
      customHeightmapTerrainProvider: new FakeCustomHeightmapTerrainProvider() as unknown,
      googleEarthEnterpriseTerrainProvider:
        new FakeGoogleEarthEnterpriseTerrainProvider() as unknown,
      cesium3DTilesTerrainData: new FakeCesium3DTilesTerrainData() as unknown,
      googleEarthEnterpriseTerrainData: new FakeGoogleEarthEnterpriseTerrainData() as unknown,
      heightmapTerrainData: new FakeHeightmapTerrainData() as unknown,
      quantizedMeshTerrainData: new FakeQuantizedMeshTerrainData() as unknown,
      bingMapsGeocoderService: new FakeBingMapsGeocoderService() as unknown,
      cartographicGeocoderService: new FakeCartographicGeocoderService() as unknown,
      googleGeocoderService: new FakeGoogleGeocoderService() as unknown,
      openCageGeocoderService: new FakeOpenCageGeocoderService() as unknown,
      peliasGeocoderService: new FakePeliasGeocoderService() as unknown,
      i3sDataProvider: new FakeI3SDataProvider() as unknown,
      i3sField: new FakeI3SField() as unknown,
      i3sLayer: new FakeI3SLayer() as unknown,
      i3sNode: new FakeI3SNode() as unknown,
      pinBuilder: new FakePinBuilder() as unknown,
      timeDynamicImagery: new FakeTimeDynamicImagery() as unknown,
      czmlDataSource: new FakeCzmlDataSourceInstance() as unknown,
      geoJsonDataSource: new FakeGeoJsonDataSourceInstance() as unknown,
    },
    // A real `Viewer` property (`viewer.cesiumWidget`); `flyTo`/`zoomTo` are genuinely
    // Promise-returning instance methods with no named async binding.
    cesiumWidget: {
      flyTo: vi.fn(async (_target: unknown, _options?: unknown) => true),
      zoomTo: vi.fn(async (_target: unknown, _offset?: unknown) => true),
    },
    // The real, *private* `Viewer._cesiumWidget` (distinct from the public `cesiumWidget` above)
    // that `Viewer.prototype.trackedEntity`'s real setter delegates to
    // (`this._cesiumWidget.trackedEntity = value`) \u2014 needed so the `trackedEntity` accessor
    // below reproduces the exact real-Cesium shape that trips the "no `set` trap" bug.
    _cesiumWidget: {
      trackedEntity: undefined as unknown,
    },
    // Mirrors real Cesium's `Viewer.prototype.trackedEntity` accessor, which internally reads/
    // writes `this._cesiumWidget.trackedEntity` \u2014 see `createGuardedProxy`'s `set` trap doc
    // comment in `guarded-viewer-proxy.ts` for why this specific shape used to throw "Cesium
    // sandbox access to \"_cesiumWidget\" is not allowed."
    get trackedEntity(): unknown {
      return (this as { _cesiumWidget: { trackedEntity: unknown } })._cesiumWidget.trackedEntity;
    },
    set trackedEntity(value: unknown) {
      (this as { _cesiumWidget: { trackedEntity: unknown } })._cesiumWidget.trackedEntity = value;
    },
    destroy: vi.fn(),
    camera: {
      flyTo: vi.fn((_opts: { destination: Cartesian3 }) => {}),
      setView: vi.fn(),
      flyHome: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      lookAt: vi.fn(),
      positionCartographic: { latitude: 0.8527, longitude: 0.041, height: 1000 },
    },
    entities: {
      get values() {
        return Array.from(entitiesById.values());
      },
      add: vi.fn((opts: Record<string, unknown>) => {
        const id = (opts.id as string) ?? `entity-${nextId++}`;
        const entity = { ...opts, id };
        entitiesById.set(id, entity);
        return entity;
      }),
      remove: vi.fn((entity: { id: string }) => entitiesById.delete(entity.id)),
      removeAll: vi.fn(() => entitiesById.clear()),
      removeById: vi.fn((id: string) => entitiesById.delete(id)),
      getById: vi.fn((id: string) => entitiesById.get(id) ?? undefined),
      contains: vi.fn((entity: { id: string }) => entitiesById.has(entity.id)),
      suspendEvents: vi.fn(),
      resumeEvents: vi.fn(),
    },
    zoomTo: vi.fn(async (_target: unknown, _offset?: unknown) => true),
    flyTo: vi.fn(async (_target: unknown, _options?: unknown) => true),
    imageryLayers: {
      length: 0,
      addImageryProvider: vi.fn((provider: unknown) => ({ provider })),
      remove: vi.fn(),
      removeAll: vi.fn(),
      get: vi.fn(
        (index: number) =>
          [arcGisImageryLayer, genericImageryLayer, ionImageryLayer][index] ?? arcGisImageryLayer,
      ),
      // A genuinely Promise-returning method directly on the collection itself (not a per-layer
      // `imageryProvider`), with no named async binding.
      pickImageryLayerFeatures: vi.fn(
        async (x: number, y: number, level: number, longitude: number, latitude: number) => [
          { kind: "featureInfo", x, y, level, longitude, latitude },
        ],
      ),
    },
    geocoderService: new FakeIonGeocoderService() as unknown,
    scene: {
      clampToHeightMostDetailed: vi.fn(async (positions: unknown[]) => positions),
      pickAsync: vi.fn(async (position: unknown) => ({ kind: "pick", position })),
      sampleHeightMostDetailed: vi.fn(async (positions: unknown[]) => positions),
      primitives: {
        length: 0,
        add: vi.fn((primitive: unknown) => primitive),
        remove: vi.fn(),
        get: vi.fn((_index: number) => voxelPrimitive),
      },
      groundPrimitives: {
        length: 0,
        add: vi.fn((primitive: unknown) => primitive),
      },
      postProcessStages: {
        length: 0,
        add: vi.fn((stage: unknown) => stage),
      },
      globe: new FakeGlobe(),
      terrainProvider: new FakeCesium3DTilesTerrainProvider() as unknown,
    },
    terrainProvider: new FakeArcGISTiledElevationTerrainProvider() as unknown,
    dataSources: {
      length: 0,
      add: vi.fn(async (dataSource: unknown) => dataSource),
      remove: vi.fn(),
      removeAll: vi.fn(),
    },
  };
}

const dynamicPromiseCases = [
  {
    path: "DataSourceCollection.add",
    code: `return await viewer.dataSources.add({ id: "source", entities: { values: [] } });`,
    expected: { id: "source", entities: { values: [] } },
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.dataSources.add,
  },
  {
    path: "ImageryProvider.loadImage",
    // No named async binding exists for this static factory, so this exercises the
    // static-namespace fallback + generic dynamic Promise bridge instead.
    code: `
      const provider = viewer.imageryLayers.get(1).imageryProvider;
      return await Cesium.ImageryProvider.loadImage(provider, "https://example.com/tile.png");
    `,
    expected: { kind: "imageryImage", url: "https://example.com/tile.png" },
    getMock: () => ImageryProvider.loadImage,
  },
  {
    path: "ImageryProvider.pickFeatures",
    // Reached via imagery layer index 1 (`FakeImageryProvider`), distinct from
    // `ArcGisMapServerImageryProvider.pickFeatures`'s index-0 slot above.
    code: `
      const layer = viewer.imageryLayers.get(1);
      return await layer.imageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);
    `,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(1) as { imageryProvider: FakeImageryProvider }).imageryProvider
        .pickFeatures,
  },
  {
    path: "ImageryProvider.requestImage",
    code: `
      const layer = viewer.imageryLayers.get(1);
      return await layer.imageryProvider.requestImage(2, 3, 5);
    `,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(1) as { imageryProvider: FakeImageryProvider }).imageryProvider
        .requestImage,
  },
  {
    path: "IonGeocoderService.geocode",
    // Reached via the synthetic `viewer.geocoderService` handle (see `FakeIonGeocoderService`
    // above) rather than constructing `new Cesium.IonGeocoderService(...)` in the script itself,
    // so the pre-existing mock instance stays reachable for the post-run assertion below.
    code: `return await viewer.geocoderService.geocode("Paris");`,
    expected: [{ kind: "geocodeResult", query: "Paris", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.geocoderService as FakeIonGeocoderService).geocode,
  },
  {
    path: "IonImageryProvider.fromAssetId",
    // No named async binding exists for this static factory, so this exercises the
    // static-namespace fallback + generic dynamic Promise bridge instead.
    code: `return await Cesium.IonImageryProvider.fromAssetId(3812);`,
    expected: { kind: "ionImageryProvider", assetId: 3812, options: undefined },
    getMock: () => IonImageryProvider.fromAssetId,
  },
  {
    path: "IonImageryProvider.pickFeatures",
    // Reached via imagery layer index 2 (`FakeIonImageryProvider`), distinct from the
    // `ArcGisMapServerImageryProvider`/generic `ImageryProvider` slots above.
    code: `
      const layer = viewer.imageryLayers.get(2);
      return await layer.imageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);
    `,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(2) as { imageryProvider: FakeIonImageryProvider }).imageryProvider
        .pickFeatures,
  },
  {
    path: "IonImageryProvider.requestImage",
    code: `
      const layer = viewer.imageryLayers.get(2);
      return await layer.imageryProvider.requestImage(2, 3, 5);
    `,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(2) as { imageryProvider: FakeIonImageryProvider }).imageryProvider
        .requestImage,
  },
  {
    path: "Scene.clampToHeightMostDetailed",
    code: `return await viewer.scene.clampToHeightMostDetailed([{ longitude: 1, latitude: 2 }]);`,
    expected: [{ longitude: 1, latitude: 2 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.scene.clampToHeightMostDetailed,
  },
  {
    path: "Scene.pickAsync",
    code: `return await viewer.scene.pickAsync({ x: 1, y: 2 });`,
    expected: { kind: "pick", position: { x: 1, y: 2 } },
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.scene.pickAsync,
  },
  {
    path: "Scene.sampleHeightMostDetailed",
    code: `return await viewer.scene.sampleHeightMostDetailed([{ longitude: 1, latitude: 2 }]);`,
    expected: [{ longitude: 1, latitude: 2 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.scene.sampleHeightMostDetailed,
  },
  {
    path: "ArcGISTiledElevationTerrainProvider.requestTileGeometry",
    code: `return await viewer.terrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.terrainProvider as FakeArcGISTiledElevationTerrainProvider).requestTileGeometry,
  },
  {
    path: "ArcGisMapServerImageryProvider.requestImage",
    code: `
      const layer = viewer.imageryLayers.get(0);
      return await layer.imageryProvider.requestImage(2, 3, 5);
    `,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(0) as { imageryProvider: FakeArcGisMapServerImageryProvider })
        .imageryProvider.requestImage,
  },
  {
    path: "ArcGisMapServerImageryProvider.pickFeatures",
    code: `
      const layer = viewer.imageryLayers.get(0);
      return await layer.imageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);
    `,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.imageryLayers.get(0) as { imageryProvider: FakeArcGisMapServerImageryProvider })
        .imageryProvider.pickFeatures,
  },
  {
    path: "Viewer.flyTo",
    code: `return await viewer.flyTo({});`,
    expected: true,
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.flyTo,
  },
  {
    path: "Viewer.zoomTo",
    code: `return await viewer.zoomTo({});`,
    expected: true,
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.zoomTo,
  },
  {
    path: "CesiumTerrainProvider.requestTileGeometry",
    code: `return await viewer.scene.globe.terrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.scene.globe.terrainProvider as FakeCesiumTerrainProvider).requestTileGeometry,
  },
  {
    path: "CesiumTerrainProvider.loadTileDataAvailability",
    code: `return await viewer.scene.globe.terrainProvider.loadTileDataAvailability(0, 0, 5);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.scene.globe.terrainProvider as FakeCesiumTerrainProvider).loadTileDataAvailability,
  },
  {
    path: "CesiumTerrainProvider.fromUrl",
    // This exercises the static-namespace fallback + generic dynamic Promise bridge, same as
    // `fromIonAssetId` above.
    code: `return await Cesium.CesiumTerrainProvider.fromUrl("https://example.com/terrain");`,
    expected: { kind: "terrainProvider", url: "https://example.com/terrain" },
    getMock: () => CesiumTerrainProvider.fromUrl,
  },
  {
    path: "Cesium3DTilesVoxelProvider.fromUrl",
    // No named async binding exists for this static factory, so this exercises the
    // static-namespace fallback + generic dynamic Promise bridge instead.
    code: `return await Cesium.Cesium3DTilesVoxelProvider.fromUrl("https://example.com/voxel/tileset.json");`,
    expected: { kind: "voxelProvider", url: "https://example.com/voxel/tileset.json" },
    getMock: () => Cesium3DTilesVoxelProvider.fromUrl,
  },
  {
    path: "Cesium3DTilesVoxelProvider.requestData",
    // Reached via `scene.primitives.get(index).provider`, mirroring the real
    // `new VoxelPrimitive({ provider }); scene.primitives.add(...)` object graph, rather than
    // through `fromUrl` above, for a deterministic, self-contained test double.
    code: `
      const primitive = viewer.scene.primitives.get(0);
      return await primitive.provider.requestData({ tileLevel: 0, tileX: 1, tileY: 2, tileZ: 3 });
    `,
    expected: { kind: "voxelContent", tileLevel: 0, tileX: 1, tileY: 2, tileZ: 3 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.scene.primitives.get(0) as { provider: FakeCesium3DTilesVoxelProvider }).provider
        .requestData,
  },
  {
    path: "Cesium3DTilesTerrainProvider.fromUrl",
    // No named async binding exists for this static factory, so this exercises the
    // static-namespace fallback + generic dynamic Promise bridge instead.
    code: `return await Cesium.Cesium3DTilesTerrainProvider.fromUrl("https://example.com/3d-tiles-terrain");`,
    expected: {
      kind: "cesium3DTilesTerrainProvider",
      url: "https://example.com/3d-tiles-terrain",
      options: undefined,
    },
    getMock: () => Cesium3DTilesTerrainProvider.fromUrl,
  },
  {
    path: "Cesium3DTilesTerrainProvider.fromIonAssetId",
    // This exercises the static-namespace fallback + generic dynamic Promise bridge, same as
    // `CesiumTerrainProvider.fromIonAssetId` above.
    code: `return await Cesium.Cesium3DTilesTerrainProvider.fromIonAssetId(2732686);`,
    expected: { kind: "cesium3DTilesTerrainProvider", assetId: 2732686, options: undefined },
    getMock: () => Cesium3DTilesTerrainProvider.fromIonAssetId,
  },
  {
    path: "Cesium3DTilesTerrainProvider.requestTileGeometry",
    // Reached via `scene.terrainProvider`, a real, settable property distinct from
    // `scene.globe.terrainProvider` (already `CesiumTerrainProvider`'s slot).
    code: `return await viewer.scene.terrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "cesium3DTilesTerrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.scene.terrainProvider as FakeCesium3DTilesTerrainProvider).requestTileGeometry,
  },
  {
    path: "Cesium3DTilesTerrainProvider.loadTileDataAvailability",
    code: `return await viewer.scene.terrainProvider.loadTileDataAvailability(0, 0, 5);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.scene.terrainProvider as FakeCesium3DTilesTerrainProvider).loadTileDataAvailability,
  },
  // ---------------------------------------------------------------------------------------------
  // The cases below round out coverage for every remaining "Declaration-Only Dynamic Promise
  // Candidate" in `CESIUM_COMPATIBILITY.md` that can be exercised with a deterministic double —
  // static factories via the module mock above, instance methods via `viewer.testHandles` (see
  // its doc comment) or a real Viewer property (`cesiumWidget`, `imageryLayers`). Excluded:
  // `Resource.*`/`IonResource.*` (deliberately blocked, see the security-regression tests below),
  // abstract-only declarations with no instantiable concrete owner (`GeocoderService.geocode`,
  // `TerrainData.upsample`, `TerrainProvider.loadTileDataAvailability`/`.requestTileGeometry`,
  // `VoxelProvider.requestData` — already exercised through their concrete subclasses above), and
  // genuinely wasm/worker-backed APIs with no deterministic-double equivalent (see the
  // `test.todo`s further below).
  // ---------------------------------------------------------------------------------------------
  {
    path: "ArcGisMapServerImageryProvider.fromBasemapType",
    code: `return await Cesium.ArcGisMapServerImageryProvider.fromBasemapType("SATELLITE", {});`,
    expected: { kind: "arcGisMapServerImageryProvider", style: "SATELLITE", options: {} },
    getMock: () => ArcGisMapServerImageryProvider.fromBasemapType,
  },
  {
    path: "Cesium3DTileset.loadJson",
    code: `return await Cesium.Cesium3DTileset.loadJson("https://example.com/tileset.json");`,
    expected: { kind: "tilesetJson", tilesetUrl: "https://example.com/tileset.json" },
    getMock: () => Cesium3DTileset.loadJson,
  },
  {
    path: "Material.fromTypeAsync",
    code: `return await Cesium.Material.fromTypeAsync("Water", {});`,
    expected: { kind: "material", type: "Water", options: {} },
    getMock: () => Material.fromTypeAsync,
  },
  {
    path: "GeoJsonPrimitive.fromUrl",
    code: `return await Cesium.GeoJsonPrimitive.fromUrl("https://example.com/data.geojson");`,
    expected: {
      kind: "geoJsonPrimitive",
      url: "https://example.com/data.geojson",
      options: undefined,
    },
    getMock: () => GeoJsonPrimitive.fromUrl,
  },
  {
    path: "GoogleEarthEnterpriseMetadata.fromUrl",
    code: `return await Cesium.GoogleEarthEnterpriseMetadata.fromUrl("https://example.com/gee");`,
    expected: {
      kind: "googleEarthEnterpriseMetadata",
      url: "https://example.com/gee",
      options: undefined,
    },
    getMock: () => GoogleEarthEnterpriseMetadata.fromUrl,
  },
  {
    path: "GoogleStreetViewCubeMapPanoramaProvider.fromUrl",
    code: `return await Cesium.GoogleStreetViewCubeMapPanoramaProvider.fromUrl("https://example.com/pano");`,
    expected: {
      kind: "googleStreetViewCubeMapPanoramaProvider",
      url: "https://example.com/pano",
      options: undefined,
    },
    getMock: () => GoogleStreetViewCubeMapPanoramaProvider.fromUrl,
  },
  {
    path: "TileMapServiceImageryProvider.fromUrl",
    code: `return await Cesium.TileMapServiceImageryProvider.fromUrl("https://example.com/tms");`,
    expected: {
      kind: "tileMapServiceImageryProvider",
      url: "https://example.com/tms",
      options: undefined,
    },
    getMock: () => TileMapServiceImageryProvider.fromUrl,
  },
  {
    path: "CzmlDataSource.load",
    code: `return await Cesium.CzmlDataSource.load("https://example.com/data.czml");`,
    expected: { kind: "dataSource", data: "https://example.com/data.czml", options: undefined },
    getMock: () => CzmlDataSource.load,
  },
  {
    path: "CzmlDataSource.process",
    code: `return await viewer.testHandles.czmlDataSource.process({ id: "doc" }, {});`,
    expected: { kind: "dataSource", data: { id: "doc" }, options: {} },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.czmlDataSource as FakeCzmlDataSourceInstance).process,
  },
  {
    path: "GpxDataSource.load",
    code: `return await Cesium.GpxDataSource.load("https://example.com/track.gpx");`,
    expected: { kind: "dataSource", data: "https://example.com/track.gpx", options: undefined },
    getMock: () => GpxDataSource.load,
  },
  {
    path: "KmlDataSource.load",
    code: `return await Cesium.KmlDataSource.load("https://example.com/data.kml");`,
    expected: { kind: "dataSource", data: "https://example.com/data.kml", options: undefined },
    getMock: () => KmlDataSource.load,
  },
  {
    path: "GeoJsonDataSource.process",
    code: `return await viewer.testHandles.geoJsonDataSource.process({ type: "FeatureCollection" }, {});`,
    expected: { kind: "dataSource", data: { type: "FeatureCollection" }, options: {} },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.geoJsonDataSource as FakeGeoJsonDataSourceInstance).process,
  },
  {
    path: "BingMapsImageryProvider.fromUrl",
    code: `return await Cesium.BingMapsImageryProvider.fromUrl("https://example.com/bing", {});`,
    expected: { kind: "bingMapsImageryProvider", url: "https://example.com/bing", options: {} },
    getMock: () => BingMapsImageryProvider.fromUrl,
  },
  {
    path: "BingMapsImageryProvider.requestImage",
    code: `return await viewer.testHandles.bingMapsImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.bingMapsImageryProvider as FakeBingMapsImageryProvider).requestImage,
  },
  {
    path: "Google2DImageryProvider.fromIonAssetId",
    code: `return await Cesium.Google2DImageryProvider.fromIonAssetId(4021, {});`,
    expected: { kind: "google2DImageryProvider", assetId: 4021, options: {} },
    getMock: () => Google2DImageryProvider.fromIonAssetId,
  },
  {
    path: "Google2DImageryProvider.fromUrl",
    code: `return await Cesium.Google2DImageryProvider.fromUrl("https://example.com/google2d", {});`,
    expected: { kind: "google2DImageryProvider", url: "https://example.com/google2d", options: {} },
    getMock: () => Google2DImageryProvider.fromUrl,
  },
  {
    path: "Google2DImageryProvider.requestImage",
    code: `return await viewer.testHandles.google2DImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.google2DImageryProvider as FakeGoogle2DImageryProvider).requestImage,
  },
  {
    path: "GoogleEarthEnterpriseImageryProvider.requestImage",
    code: `return await viewer.testHandles.googleEarthEnterpriseImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (
        viewer.testHandles
          .googleEarthEnterpriseImageryProvider as FakeGoogleEarthEnterpriseImageryProvider
      ).requestImage,
  },
  {
    path: "GoogleEarthEnterpriseMapsProvider.fromUrl",
    code: `return await Cesium.GoogleEarthEnterpriseMapsProvider.fromUrl("https://example.com/gee-maps", {});`,
    expected: {
      kind: "googleEarthEnterpriseMapsProvider",
      url: "https://example.com/gee-maps",
      options: {},
    },
    getMock: () => GoogleEarthEnterpriseMapsProvider.fromUrl,
  },
  {
    path: "GoogleEarthEnterpriseMapsProvider.requestImage",
    code: `return await viewer.testHandles.googleEarthEnterpriseMapsProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (
        viewer.testHandles
          .googleEarthEnterpriseMapsProvider as FakeGoogleEarthEnterpriseMapsProvider
      ).requestImage,
  },
  {
    path: "GridImageryProvider.requestImage",
    code: `return await viewer.testHandles.gridImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.gridImageryProvider as FakeGridImageryProvider).requestImage,
  },
  {
    path: "MapboxImageryProvider.requestImage",
    code: `return await viewer.testHandles.mapboxImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.mapboxImageryProvider as FakeMapboxImageryProvider).requestImage,
  },
  {
    path: "MapboxImageryProvider.pickFeatures",
    code: `return await viewer.testHandles.mapboxImageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.mapboxImageryProvider as FakeMapboxImageryProvider).pickFeatures,
  },
  {
    path: "MapboxStyleImageryProvider.requestImage",
    code: `return await viewer.testHandles.mapboxStyleImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.mapboxStyleImageryProvider as FakeMapboxStyleImageryProvider)
        .requestImage,
  },
  {
    path: "MapboxStyleImageryProvider.pickFeatures",
    code: `return await viewer.testHandles.mapboxStyleImageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.mapboxStyleImageryProvider as FakeMapboxStyleImageryProvider)
        .pickFeatures,
  },
  {
    path: "SingleTileImageryProvider.fromUrl",
    code: `return await Cesium.SingleTileImageryProvider.fromUrl("https://example.com/single-tile.png", {});`,
    expected: {
      kind: "singleTileImageryProvider",
      url: "https://example.com/single-tile.png",
      options: {},
    },
    getMock: () => SingleTileImageryProvider.fromUrl,
  },
  {
    path: "SingleTileImageryProvider.requestImage",
    code: `return await viewer.testHandles.singleTileImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.singleTileImageryProvider as FakeSingleTileImageryProvider).requestImage,
  },
  {
    path: "TileCoordinatesImageryProvider.requestImage",
    code: `return await viewer.testHandles.tileCoordinatesImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.tileCoordinatesImageryProvider as FakeTileCoordinatesImageryProvider)
        .requestImage,
  },
  {
    path: "UrlTemplateImageryProvider.requestImage",
    code: `return await viewer.testHandles.urlTemplateImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.urlTemplateImageryProvider as FakeUrlTemplateImageryProvider)
        .requestImage,
  },
  {
    path: "UrlTemplateImageryProvider.pickFeatures",
    code: `return await viewer.testHandles.urlTemplateImageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.urlTemplateImageryProvider as FakeUrlTemplateImageryProvider)
        .pickFeatures,
  },
  {
    path: "WebMapServiceImageryProvider.requestImage",
    code: `return await viewer.testHandles.webMapServiceImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.webMapServiceImageryProvider as FakeWebMapServiceImageryProvider)
        .requestImage,
  },
  {
    path: "WebMapServiceImageryProvider.pickFeatures",
    code: `return await viewer.testHandles.webMapServiceImageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.webMapServiceImageryProvider as FakeWebMapServiceImageryProvider)
        .pickFeatures,
  },
  {
    path: "WebMapTileServiceImageryProvider.requestImage",
    code: `return await viewer.testHandles.webMapTileServiceImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.webMapTileServiceImageryProvider as FakeWebMapTileServiceImageryProvider)
        .requestImage,
  },
  {
    path: "WebMapTileServiceImageryProvider.pickFeatures",
    code: `return await viewer.testHandles.webMapTileServiceImageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.webMapTileServiceImageryProvider as FakeWebMapTileServiceImageryProvider)
        .pickFeatures,
  },
  {
    path: "Azure2DImageryProvider.requestImage",
    code: `return await viewer.testHandles.azure2DImageryProvider.requestImage(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.azure2DImageryProvider as FakeAzure2DImageryProvider).requestImage,
  },
  {
    path: "VRTheWorldTerrainProvider.fromUrl",
    code: `return await Cesium.VRTheWorldTerrainProvider.fromUrl("https://example.com/vr-terrain", {});`,
    expected: {
      kind: "vrTheWorldTerrainProvider",
      url: "https://example.com/vr-terrain",
      options: {},
    },
    getMock: () => VRTheWorldTerrainProvider.fromUrl,
  },
  {
    path: "VRTheWorldTerrainProvider.requestTileGeometry",
    code: `return await viewer.testHandles.vrTheWorldTerrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.vrTheWorldTerrainProvider as FakeVRTheWorldTerrainProvider)
        .requestTileGeometry,
  },
  {
    path: "VRTheWorldTerrainProvider.loadTileDataAvailability",
    code: `return await viewer.testHandles.vrTheWorldTerrainProvider.loadTileDataAvailability(0, 0, 5);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.vrTheWorldTerrainProvider as FakeVRTheWorldTerrainProvider)
        .loadTileDataAvailability,
  },
  {
    path: "EllipsoidTerrainProvider.requestTileGeometry",
    code: `return await viewer.testHandles.ellipsoidTerrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.ellipsoidTerrainProvider as FakeEllipsoidTerrainProvider)
        .requestTileGeometry,
  },
  {
    path: "CustomHeightmapTerrainProvider.requestTileGeometry",
    code: `return await viewer.testHandles.customHeightmapTerrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.customHeightmapTerrainProvider as FakeCustomHeightmapTerrainProvider)
        .requestTileGeometry,
  },
  {
    path: "CustomHeightmapTerrainProvider.loadTileDataAvailability",
    code: `return await viewer.testHandles.customHeightmapTerrainProvider.loadTileDataAvailability(0, 0, 5);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.customHeightmapTerrainProvider as FakeCustomHeightmapTerrainProvider)
        .loadTileDataAvailability,
  },
  {
    path: "GoogleEarthEnterpriseTerrainProvider.requestTileGeometry",
    code: `return await viewer.testHandles.googleEarthEnterpriseTerrainProvider.requestTileGeometry(0, 0, 5);`,
    expected: { kind: "terrainData", x: 0, y: 0, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (
        viewer.testHandles
          .googleEarthEnterpriseTerrainProvider as FakeGoogleEarthEnterpriseTerrainProvider
      ).requestTileGeometry,
  },
  {
    path: "Cesium3DTilesTerrainData.upsample",
    code: `return await viewer.testHandles.cesium3DTilesTerrainData.upsample(undefined, 0, 0, 5, 0, 0, 6);`,
    expected: {
      kind: "cesium3DTilesTerrainData",
      thisX: 0,
      thisY: 0,
      thisLevel: 5,
      descendantX: 0,
      descendantY: 0,
      descendantLevel: 6,
    },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.cesium3DTilesTerrainData as FakeCesium3DTilesTerrainData).upsample,
  },
  {
    path: "GoogleEarthEnterpriseTerrainData.upsample",
    code: `return await viewer.testHandles.googleEarthEnterpriseTerrainData.upsample(undefined, 0, 0, 5, 0, 0, 6);`,
    expected: {
      kind: "googleEarthEnterpriseTerrainData",
      thisX: 0,
      thisY: 0,
      thisLevel: 5,
      descendantX: 0,
      descendantY: 0,
      descendantLevel: 6,
    },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.googleEarthEnterpriseTerrainData as FakeGoogleEarthEnterpriseTerrainData)
        .upsample,
  },
  {
    path: "HeightmapTerrainData.upsample",
    code: `return await viewer.testHandles.heightmapTerrainData.upsample(undefined, 0, 0, 5, 0, 0, 6);`,
    expected: {
      kind: "heightmapTerrainData",
      thisX: 0,
      thisY: 0,
      thisLevel: 5,
      descendantX: 0,
      descendantY: 0,
      descendantLevel: 6,
    },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.heightmapTerrainData as FakeHeightmapTerrainData).upsample,
  },
  {
    path: "QuantizedMeshTerrainData.upsample",
    code: `return await viewer.testHandles.quantizedMeshTerrainData.upsample(undefined, 0, 0, 5, 0, 0, 6);`,
    expected: {
      kind: "quantizedMeshTerrainData",
      thisX: 0,
      thisY: 0,
      thisLevel: 5,
      descendantX: 0,
      descendantY: 0,
      descendantLevel: 6,
    },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.quantizedMeshTerrainData as FakeQuantizedMeshTerrainData).upsample,
  },
  {
    path: "BingMapsGeocoderService.geocode",
    code: `return await viewer.testHandles.bingMapsGeocoderService.geocode("Paris");`,
    expected: [{ kind: "geocodeResult", query: "Paris", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.bingMapsGeocoderService as FakeBingMapsGeocoderService).geocode,
  },
  {
    path: "CartographicGeocoderService.geocode",
    code: `return await viewer.testHandles.cartographicGeocoderService.geocode("1.0, 2.0");`,
    expected: [{ kind: "geocodeResult", query: "1.0, 2.0", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.cartographicGeocoderService as FakeCartographicGeocoderService).geocode,
  },
  {
    path: "GoogleGeocoderService.geocode",
    code: `return await viewer.testHandles.googleGeocoderService.geocode("Paris");`,
    expected: [{ kind: "geocodeResult", query: "Paris", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.googleGeocoderService as FakeGoogleGeocoderService).geocode,
  },
  {
    path: "OpenCageGeocoderService.geocode",
    code: `return await viewer.testHandles.openCageGeocoderService.geocode("Paris");`,
    expected: [{ kind: "geocodeResult", query: "Paris", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.openCageGeocoderService as FakeOpenCageGeocoderService).geocode,
  },
  {
    path: "PeliasGeocoderService.geocode",
    code: `return await viewer.testHandles.peliasGeocoderService.geocode("Paris");`,
    expected: [{ kind: "geocodeResult", query: "Paris", type: undefined }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.peliasGeocoderService as FakePeliasGeocoderService).geocode,
  },
  {
    path: "I3SDataProvider.fromUrl",
    code: `return await Cesium.I3SDataProvider.fromUrl("https://example.com/i3s", {});`,
    expected: { kind: "i3sDataProvider", url: "https://example.com/i3s", options: {} },
    getMock: () => I3SDataProvider.fromUrl,
  },
  {
    path: "I3SDataProvider.filterByAttributes",
    code: `return await viewer.testHandles.i3sDataProvider.filterByAttributes([{ name: "class" }]);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.i3sDataProvider as FakeI3SDataProvider).filterByAttributes,
  },
  {
    path: "I3SField.load",
    code: `return await viewer.testHandles.i3sField.load();`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.i3sField as FakeI3SField).load,
  },
  {
    path: "I3SLayer.filterByAttributes",
    code: `return await viewer.testHandles.i3sLayer.filterByAttributes([{ name: "class" }]);`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.i3sLayer as FakeI3SLayer).filterByAttributes,
  },
  {
    path: "I3SNode.loadField",
    code: `return await viewer.testHandles.i3sNode.loadField("class");`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.i3sNode as FakeI3SNode).loadField,
  },
  {
    path: "I3SNode.loadFields",
    code: `return await viewer.testHandles.i3sNode.loadFields();`,
    expected: null,
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.i3sNode as FakeI3SNode).loadFields,
  },
  {
    path: "ITwinData.createDataSourceForRealityDataId",
    code: `return await Cesium.ITwinData.createDataSourceForRealityDataId({ realityDataId: "rd-1", iTwinId: "it-1" });`,
    expected: { kind: "iTwinDataSource", options: { realityDataId: "rd-1", iTwinId: "it-1" } },
    getMock: () => ITwinData.createDataSourceForRealityDataId,
  },
  {
    path: "ITwinData.createTilesetForRealityDataId",
    code: `return await Cesium.ITwinData.createTilesetForRealityDataId({ realityDataId: "rd-1", iTwinId: "it-1" });`,
    expected: { kind: "iTwinTileset", options: { realityDataId: "rd-1", iTwinId: "it-1" } },
    getMock: () => ITwinData.createTilesetForRealityDataId,
  },
  {
    path: "ITwinData.createTilesetFromIModelId",
    code: `return await Cesium.ITwinData.createTilesetFromIModelId({ iModelId: "im-1" });`,
    expected: { kind: "iTwinTileset", options: { iModelId: "im-1" } },
    getMock: () => ITwinData.createTilesetFromIModelId,
  },
  {
    path: "ITwinData.loadGeospatialFeatures",
    code: `return await Cesium.ITwinData.loadGeospatialFeatures({ iTwinId: "it-1", collectionId: "coll-1" });`,
    expected: {
      kind: "iTwinGeospatialFeatures",
      options: { iTwinId: "it-1", collectionId: "coll-1" },
    },
    getMock: () => ITwinData.loadGeospatialFeatures,
  },
  {
    path: "ImageryLayerCollection.pickImageryLayerFeatures",
    code: `return await viewer.imageryLayers.pickImageryLayerFeatures(2, 3, 5, 12.5, 41.9);`,
    expected: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      viewer.imageryLayers.pickImageryLayerFeatures,
  },
  {
    path: "CesiumWidget.flyTo",
    code: `return await viewer.cesiumWidget.flyTo({});`,
    expected: true,
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.cesiumWidget.flyTo,
  },
  {
    path: "CesiumWidget.zoomTo",
    code: `return await viewer.cesiumWidget.zoomTo({});`,
    expected: true,
    getMock: (viewer: ReturnType<typeof fakeViewer>) => viewer.cesiumWidget.zoomTo,
  },
  {
    path: "PinBuilder.fromMakiIconId",
    code: `return await viewer.testHandles.pinBuilder.fromMakiIconId("bus", "#ff0000");`,
    expected: { kind: "pinCanvas", id: "bus", color: "#ff0000" },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.pinBuilder as FakePinBuilder).fromMakiIconId,
  },
  {
    path: "PinBuilder.fromUrl",
    code: `return await viewer.testHandles.pinBuilder.fromUrl("https://example.com/pin.png", "#ff0000", 32);`,
    expected: { kind: "pinCanvas", url: "https://example.com/pin.png", color: "#ff0000", size: 32 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.pinBuilder as FakePinBuilder).fromUrl,
  },
  {
    path: "TimeDynamicImagery.getFromCache",
    code: `return await viewer.testHandles.timeDynamicImagery.getFromCache(2, 3, 5);`,
    expected: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      (viewer.testHandles.timeDynamicImagery as FakeTimeDynamicImagery).getFromCache,
  },
  {
    path: "exportKml",
    code: `return await Cesium.exportKml({ modelCallback: undefined });`,
    expected: { kind: "kmlExport", options: { modelCallback: undefined } },
    getMock: () => exportKml,
  },
  {
    path: "sampleTerrain",
    code: `return await Cesium.sampleTerrain({}, 5, [{ longitude: 1, latitude: 2 }]);`,
    expected: {
      kind: "sampledPositions",
      terrainProvider: {},
      level: 5,
      positions: [{ longitude: 1, latitude: 2 }],
    },
    getMock: () => sampleTerrain,
  },
  {
    path: "sampleTerrainMostDetailed",
    code: `return await Cesium.sampleTerrainMostDetailed({}, [{ longitude: 1, latitude: 2 }]);`,
    expected: {
      kind: "sampledPositions",
      terrainProvider: {},
      positions: [{ longitude: 1, latitude: 2 }],
    },
    getMock: () => sampleTerrainMostDetailed,
  },
  {
    path: "createGooglePhotorealistic3DTileset",
    code: `return await Cesium.createGooglePhotorealistic3DTileset({ key: "test-key" });`,
    expected: { kind: "tileset", apiOptions: { key: "test-key" } },
    getMock: () => createGooglePhotorealistic3DTileset,
  },
  {
    path: "createWorldImageryAsync",
    code: `return await Cesium.createWorldImageryAsync({ style: "AERIAL" });`,
    expected: { kind: "imageryProvider", options: { style: "AERIAL" } },
    getMock: () => createWorldImageryAsync,
  },
  {
    path: "createOsmBuildingsAsync",
    code: `return await Cesium.createOsmBuildingsAsync({ style: undefined });`,
    expected: { kind: "osmBuildingsTileset", options: { style: undefined } },
    getMock: () => createOsmBuildingsAsync,
  },
  {
    path: "createWorldTerrainAsync",
    code: `return await Cesium.createWorldTerrainAsync({ requestVertexNormals: true });`,
    expected: { kind: "terrainProvider", options: { requestVertexNormals: true } },
    getMock: () => createWorldTerrainAsync,
  },
  {
    path: "createWorldBathymetryAsync",
    code: `return await Cesium.createWorldBathymetryAsync({ requestVertexNormals: true });`,
    expected: { kind: "bathymetryProvider", options: { requestVertexNormals: true } },
    getMock: () => createWorldBathymetryAsync,
  },
  {
    path: "Cesium3DTileset.fromUrl",
    code: `return await Cesium.Cesium3DTileset.fromUrl("https://example.com/tileset.json", {});`,
    expected: { kind: "tileset", url: "https://example.com/tileset.json", options: {} },
    getMock: () => Cesium3DTileset.fromUrl,
  },
  {
    path: "Cesium3DTileset.fromIonAssetId",
    code: `return await Cesium.Cesium3DTileset.fromIonAssetId(2464651, {});`,
    expected: { kind: "tileset", assetId: 2464651, options: {} },
    getMock: () => Cesium3DTileset.fromIonAssetId,
  },
  {
    path: "CesiumTerrainProvider.fromIonAssetId",
    code: `return await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {});`,
    expected: { kind: "terrainProvider", assetId: 1, options: {} },
    getMock: () => CesiumTerrainProvider.fromIonAssetId,
  },
  {
    path: "ArcGISTiledElevationTerrainProvider.fromUrl",
    code: `return await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://example.com/terrain", {});`,
    expected: { kind: "terrainProvider", url: "https://example.com/terrain", options: {} },
    getMock: () => ArcGISTiledElevationTerrainProvider.fromUrl,
  },
  {
    path: "ArcGisMapServerImageryProvider.fromUrl",
    code: `return await Cesium.ArcGisMapServerImageryProvider.fromUrl("https://example.com/arcgis", {});`,
    expected: {
      kind: "arcGisMapServerImageryProvider",
      url: "https://example.com/arcgis",
      options: {},
    },
    getMock: () => ArcGisMapServerImageryProvider.fromUrl,
  },
  {
    path: "GeoJsonDataSource.load",
    code: `return await Cesium.GeoJsonDataSource.load("https://example.com/data.geojson", {});`,
    expected: { kind: "dataSource", data: "https://example.com/data.geojson", options: {} },
    getMock: () => GeoJsonDataSource.load,
  },
  {
    path: "Model.fromGltfAsync",
    code: `return await Cesium.Model.fromGltfAsync({ url: "https://example.com/model.glb" });`,
    expected: { kind: "model", options: { url: "https://example.com/model.glb" } },
    getMock: () => Model.fromGltfAsync,
  },
] as const;

const dynamicPromiseGapPaths = [] as const;

// These 3 are genuinely runtime-tested (see the dedicated tests further below that monkey-patch
// the real `Resource.prototype.fetchJson`), but don't fit the generic `dynamicPromiseCases`
// `test.each` shape: `GroundPrimitive`/`GroundPolylinePrimitive.initializeTerrainHeights` share
// one Cesium-internal process-global memoized cache (`ApproximateTerrainHeights`), so they're
// exercised together in a single test rather than independently: exactly-once call-count
// assertions across separate cases would be wrong once the cache is warm.
const manuallyTestedRuntimeCoveragePaths = [
  "GroundPolylinePrimitive.initializeTerrainHeights",
  "GroundPrimitive.initializeTerrainHeights",
  "Transforms.preloadIcrfFixed",
] as const;

afterEach(() => {
  vi.clearAllMocks();
});

describe("runCesiumCodeInSandbox", () => {
  test("exposes non-blocked Cesium exports by default", async () => {
    const outcome = await runCesiumCodeInSandbox({
      viewer: fakeViewer() as never,
      code: `return { defined: Cesium.defined(0), arcType: Cesium.ArcType.GEODESIC };`,
    });

    expect(outcome).toEqual({
      success: true,
      result: { defined: true, arcType: 1 },
    });
  });

  test("composes Cesium.Cartesian3.fromDegrees + viewer.camera.flyTo from generated code", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const destination = await Cesium.Cartesian3.fromDegrees(2.3522, 48.8566, 1000);
        await viewer.camera.flyTo({ destination });
        return "flew";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "flew" });
    expect(viewer.camera.flyTo).toHaveBeenCalledTimes(1);
    const passedDestination = viewer.camera.flyTo.mock.calls[0][0].destination;
    const expected = Cartesian3.fromDegrees(2.3522, 48.8566, 1000);
    expect(passedDestination.x).toBeCloseTo(expected.x, 3);
    expect(passedDestination.y).toBeCloseTo(expected.y, 3);
    expect(passedDestination.z).toBeCloseTo(expected.z, 3);
  });

  test("reports the generated source location for a nonexistent Cesium method", async () => {
    const viewer = fakeViewer();
    (viewer.scene as typeof viewer.scene & { camera: typeof viewer.camera }).camera = viewer.camera;

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `const target = Cesium.Cartesian3.fromDegrees(-74.006, 40.7128, 0);
viewer.scene.camera.flyAround(target, 0.8);`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain("TypeError: not a function");
    expect(outcome.error).toContain("generated code line 2");
    expect(outcome.error).toContain("viewer.scene.camera.flyAround(target, 0.8);");
  });

  test("composes an entity add/remove round trip using a real returned object handle", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const destination = await Cesium.Cartesian3.fromDegrees(0, 0, 0);
        const entity = await viewer.entities.add({ position: destination, name: "test-point" });
        await viewer.entities.remove(entity);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(viewer.entities.add).toHaveBeenCalledTimes(1);
    expect(viewer.entities.remove).toHaveBeenCalledTimes(1);
  });

  test("reads camera position via bound getPositionCartographic and converts with Cesium.Math", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const carto = await viewer.camera.getPositionCartographic();
        return carto;
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { latitude: number; longitude: number; height: number };
    expect(result.height).toBe(1000);
  });

  test("rejects a lifecycle call even when the real Viewer exposes it", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: "return await viewer.destroy();",
    });

    expect(outcome.success).toBe(false);
    expect(viewer.destroy).not.toHaveBeenCalled();
  });

  test("rejects a forged/unknown object handle passed back into a bound call", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        return await viewer.entities.remove({ __cesiumSandboxHandle__: "not-a-real-handle" });
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/unknown or expired sandbox handle/i);
  });

  test("composes two sequential flyTo calls without crashing (flyTo is fire-and-forget, not Asyncify-backed)", async () => {
    const viewer = fakeViewer();

    // `camera.flyTo` resolves as soon as the flight is *started*, not once it *completes* — a
    // deliberate design tradeoff (see the comment on its binding in `cesium-bindings.ts`) that
    // keeps it off the QuickJS-wasm Asyncify bridge entirely, avoiding a reproducible upstream
    // native crash once more than one asyncified host call executes in a script. This test proves
    // that tradeoff: multiple sequential `flyTo` calls in one generated script are safe.
    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const a = await Cesium.Cartesian3.fromDegrees(2.3522, 48.8566, 1000);
        const b = await Cesium.Cartesian3.fromDegrees(-0.1276, 51.5074, 1000);
        await viewer.camera.flyTo({ destination: a });
        await viewer.camera.flyTo({ destination: b });
        return "flew twice";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "flew twice" });
    expect(viewer.camera.flyTo).toHaveBeenCalledTimes(2);
  });

  test("suspends/resumes entity collection events around a batch of adds", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        await viewer.entities.suspendEvents();
        for (let i = 0; i < 3; i++) {
          await viewer.entities.add({ position: await Cesium.Cartesian3.fromDegrees(i, i, 0) });
        }
        await viewer.entities.resumeEvents();
        return "batched";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "batched" });
    expect(viewer.entities.suspendEvents).toHaveBeenCalledTimes(1);
    expect(viewer.entities.resumeEvents).toHaveBeenCalledTimes(1);
    expect(viewer.entities.add).toHaveBeenCalledTimes(3);
  });

  test("looks up, checks membership of, and removes an entity by id", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const entity = await viewer.entities.add({ id: "my-entity", name: "test" });
        const found = await viewer.entities.getById("my-entity");
        const isMember = await viewer.entities.contains(found);
        await viewer.entities.removeById("my-entity");
        return { foundName: found.name, isMember };
      `,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.result).toEqual({ foundName: "test", isMember: true });
    expect(viewer.entities.removeById).toHaveBeenCalledWith("my-entity");
  });

  test("composes camera.flyHome/zoomIn/zoomOut/lookAt", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const entity = await viewer.entities.add({ position: await Cesium.Cartesian3.fromDegrees(0, 0, 0) });
        await viewer.camera.flyHome(2);
        await viewer.camera.zoomIn(100);
        await viewer.camera.zoomOut(50);
        await viewer.camera.lookAt(entity.position, new Cesium.HeadingPitchRange(0, -0.5, 1000));
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(viewer.camera.flyHome).toHaveBeenCalledWith(2);
    expect(viewer.camera.zoomIn).toHaveBeenCalledWith(100);
    expect(viewer.camera.zoomOut).toHaveBeenCalledWith(50);
    expect(viewer.camera.lookAt).toHaveBeenCalledTimes(1);
    const [, offset] = viewer.camera.lookAt.mock.calls[0];
    expect(offset.heading).toBeCloseTo(0, 5);
    expect(offset.range).toBeCloseTo(1000, 5);
  });

  test.each(["zoomTo", "flyTo"] as const)(
    "routes Promise-returning viewer.%s through the generic dynamic Promise bridge",
    async (method) => {
      const viewer = fakeViewer();
      viewer[method].mockResolvedValueOnce(true);

      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code: `return await viewer.${method}({});`,
      });

      expect(outcome).toEqual({ success: true, result: true });
      expect(viewer[method]).toHaveBeenCalledTimes(1);
      expect(viewer[method]).toHaveBeenCalledWith({});
    },
  );

  // `viewer.flyTo`/`zoomTo` used to be routed through QuickJS's Asyncify bridge, which imposed a
  // "one async call per script" guard and reproducibly crashed the interpreter (a native
  // `Assertion failed: p->ref_count == 0, at free_zero_refcount` abort) the moment a second
  // Asyncify-backed call actually executed in the same script. Now that they flow through the
  // same generic, `ctx.newPromise()`-based dynamic Promise bridge as every other Promise-returning
  // viewer method, that restriction (and the crash) no longer applies to them.
  test("allows both viewer.flyTo and viewer.zoomTo in the same script", async () => {
    const viewer = fakeViewer();
    viewer.flyTo.mockResolvedValueOnce(true);
    viewer.zoomTo.mockResolvedValueOnce(true);

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const flew = await viewer.flyTo({});
        const zoomed = await viewer.zoomTo({});
        return flew && zoomed;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(viewer.flyTo).toHaveBeenCalledTimes(1);
    expect(viewer.zoomTo).toHaveBeenCalledTimes(1);
  });

  test("computes Cartesian3 vector math and Cesium.Math helpers entirely in-guest", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const a = new Cesium.Cartesian3(1, 2, 3);
        const b = new Cesium.Cartesian3(4, 5, 6);
        // Real CesiumJS's \`Cartesian3.add\`/\`subtract\`/... always take a \`result\` output
        // parameter (to avoid an allocation) rather than returning a new instance — unlike the
        // sandbox's previous hand-rolled reimplementation, this now runs the real bundled class.
        const sum = Cesium.Cartesian3.add(a, b, new Cesium.Cartesian3());
        const dist = Cesium.Cartesian3.distance(a, b);
        const clamped = Cesium.Math.clamp(15, 0, 10);
        return { sum: { x: sum.x, y: sum.y, z: sum.z }, dist, clamped };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as {
      sum: { x: number; y: number; z: number };
      dist: number;
      clamped: number;
    };
    expect(result.sum).toEqual({ x: 5, y: 7, z: 9 });
    expect(result.dist).toBeCloseTo(Math.sqrt(27), 5);
    expect(result.clamped).toBe(10);
  });

  test("loads world imagery via the (mocked) async factory and adds it as an imagery layer", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const provider = await Cesium.createWorldImageryAsync();
        const layer = await viewer.imageryLayers.addImageryProvider(provider);
        return layer !== null;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(createWorldImageryAsync).toHaveBeenCalledTimes(1);
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledTimes(1);
    const passedProvider = viewer.imageryLayers.addImageryProvider.mock.calls[0][0] as {
      kind: string;
    };
    expect(passedProvider.kind).toBe("imageryProvider");
  });

  test("loads OSM buildings via Cesium.createOsmBuildingsAsync and adds them to scene.primitives", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const tileset = await Cesium.createOsmBuildingsAsync();
        await viewer.scene.primitives.add(tileset);
        return "added";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "added" });
    expect(createOsmBuildingsAsync).toHaveBeenCalledTimes(1);
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  test("rejects an unawaited OSM buildings Promise before adding an invalid primitive", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `viewer.scene.primitives.add(Cesium.createOsmBuildingsAsync());`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/Promise cannot be passed.*Await the Promise/i);
    expect(viewer.scene.primitives.add).not.toHaveBeenCalled();
  });

  test("loads a 3D Tileset by URL and adds it to scene.primitives", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      allowedNetworkOrigins: ["https://example.com"],
      code: `
        const tileset = await Cesium.Cesium3DTileset.fromUrl("https://example.com/tileset.json");
        await viewer.scene.primitives.add(tileset);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(Cesium3DTileset.fromUrl).toHaveBeenCalledWith("https://example.com/tileset.json");
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  test("constructs Cesium3DTileStyle through the static bridge and assigns it to a tileset", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(75343);
        tileset.style = new Cesium.Cesium3DTileStyle({ color: "color('red')" });
        await viewer.scene.primitives.add(tileset);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(Cesium3DTileset.fromIonAssetId).toHaveBeenCalledWith(75343);
    const addedTileset = viewer.scene.primitives.add.mock.calls[0][0] as { style: unknown };
    // Proves the guest's `tileset.style = ...` assignment actually reached the real object
    // (the `set` trap on the remote proxy), not just the guest's own inert local proxy target.
    expect(addedTileset.style).toBeInstanceOf(Cesium3DTileStyle);
  });

  test("loads a terrain provider by Ion asset id and assigns it via scene.globe.terrainProvider = ...", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
        viewer.scene.globe.terrainProvider = terrainProvider;
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(CesiumTerrainProvider.fromIonAssetId).toHaveBeenCalledWith(1);
    expect((viewer.scene.globe.terrainProvider as { kind: string }).kind).toBe("terrainProvider");
  });

  test("loads an ArcGIS tiled elevation terrain provider by URL and assigns it via viewer.terrainProvider = ...", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      allowedNetworkOrigins: ["https://elevation3d.arcgis.com"],
      code: `
        const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
          "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
          { token: "test-token" }
        );
        viewer.terrainProvider = terrainProvider;
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(ArcGISTiledElevationTerrainProvider.fromUrl).toHaveBeenCalledWith(
      "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
      { token: "test-token" },
    );
    expect((viewer.terrainProvider as { kind: string }).kind).toBe("terrainProvider");
  });

  // Each `runCesiumCodeInSandbox` call is a separate script/interpreter, so switching the terrain
  // provider (a second, genuinely async CesiumJS action) in its own run is unaffected by anything
  // that happened in a prior run.
  test("switches the terrain provider via Cesium.createWorldTerrainAsync", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const terrain = await Cesium.createWorldTerrainAsync();
        await viewer.scene.setTerrainProvider(terrain);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(createWorldTerrainAsync).toHaveBeenCalledTimes(1);
    expect((viewer.terrainProvider as { kind: string }).kind).toBe("terrainProvider");
  });

  test("runtime coverage manifest exactly matches the dynamic Promise cases", () => {
    expect(
      [
        ...dynamicPromiseCases.map(({ path }) => path),
        ...manuallyTestedRuntimeCoveragePaths,
      ].sort(),
    ).toEqual([...CESIUM_DYNAMIC_PROMISE_RUNTIME_COVERAGE].sort());
    expect([...dynamicPromiseGapPaths].sort()).toEqual(
      [...CESIUM_DYNAMIC_PROMISE_RUNTIME_GAPS].sort(),
    );
  });

  // `GroundPrimitive`/`GroundPolylinePrimitive.initializeTerrainHeights` both delegate to the
  // exact same Cesium-internal `ApproximateTerrainHeights.initialize()` (confirmed by reading
  // `node_modules/cesium/Build/CesiumUnminified/Cesium.js` directly), which calls the real
  // `Resource.fetchJson("Assets/approximateTerrainHeights.json")` and memoizes the resolved
  // promise/data in Cesium-internal process-global state shared by BOTH classes — not per-call,
  // per-instance state. Monkey-patching the real `Resource.prototype.fetchJson` (the actual
  // host-side network seam both factories funnel through, restored in `finally`) avoids any real
  // network access. Both calls are exercised together in one script/test rather than as separate
  // cases: the second call reuses the first's already-memoized promise instead of invoking
  // `Resource.fetchJson` again, so an exactly-once call-count assertion per class would be wrong.
  test("dynamically bridges GroundPrimitive.initializeTerrainHeights and GroundPolylinePrimitive.initializeTerrainHeights (shared ApproximateTerrainHeights cache)", async () => {
    const viewer = fakeViewer();
    const originalFetchJson = Resource.prototype.fetchJson;
    const fetchJsonMock = vi.fn(async () => ({ "0-0-0": [0, 100] }));
    Resource.prototype.fetchJson = fetchJsonMock as typeof Resource.prototype.fetchJson;

    try {
      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code: `
          await Cesium.GroundPrimitive.initializeTerrainHeights();
          await Cesium.GroundPolylinePrimitive.initializeTerrainHeights();
          return "done";
        `,
      });

      expect(outcome).toEqual({ success: true, result: "done" });
      expect(fetchJsonMock).toHaveBeenCalled();
    } finally {
      Resource.prototype.fetchJson = originalFetchJson;
    }
  });

  // `Transforms.preloadIcrfFixed` delegates to `Iau2006XysData.prototype.preload`, which fetches
  // real IAU2006 XYS chunk files via the same real `Resource.fetchJson` seam as the Ground*
  // pair above (confirmed via the same source read), memoized per chunk index on Cesium's own
  // `Transforms.iau2006XysData` singleton.
  test("dynamically bridges Transforms.preloadIcrfFixed", async () => {
    const viewer = fakeViewer();
    const originalFetchJson = Resource.prototype.fetchJson;
    const fetchJsonMock = vi.fn(async () => ({ samples: [] }));
    Resource.prototype.fetchJson = fetchJsonMock as typeof Resource.prototype.fetchJson;

    try {
      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code: `
          const start = Cesium.JulianDate.now();
          const stop = Cesium.JulianDate.addSeconds(start, 3600, new Cesium.JulianDate());
          const interval = new Cesium.TimeInterval({ start, stop });
          await Cesium.Transforms.preloadIcrfFixed(interval);
          return "done";
        `,
      });

      expect(outcome).toEqual({ success: true, result: "done" });
      expect(fetchJsonMock).toHaveBeenCalled();
    } finally {
      Resource.prototype.fetchJson = originalFetchJson;
    }
  });

  test.each(dynamicPromiseCases)(
    "dynamically bridges $path through an allowed host handle",
    async ({ code, expected, getMock }) => {
      const viewer = fakeViewer();

      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code,
        allowedNetworkOrigins: ["https://example.com"],
      });

      expect(outcome).toEqual({ success: true, result: expected });
      expect(getMock(viewer)).toHaveBeenCalledTimes(1);
    },
  );

  test("returns a rejected dynamically bridged Promise without triggering the upstream QuickJS Asyncify crash", async () => {
    const viewer = fakeViewer();
    viewer.scene.pickAsync.mockRejectedValueOnce(new Error("pick failed"));

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return await viewer.scene.pickAsync({ x: 1, y: 2 });`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/pick failed/);
  });

  // Generated code very commonly chains a bare `.then(...)` onto a Promise-returning call as a
  // fire-and-forget statement instead of `await`ing (or `return`ing) it. Without a post-completion
  // drain window, the wrapped script's own top-level `async` function resolves the instant its
  // synchronous portion finishes — before the dangling `GeoJsonDataSource.load(...).then(...)`
  // callback (which mutates the real `Viewer` via `viewer.dataSources.add`) ever runs — and the VM
  // is disposed out from under it, so the mutation silently never happens despite the sandbox
  // reporting success.
  test("still applies a fire-and-forget .then() continuation's Viewer mutation before disposing", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      allowedNetworkOrigins: ["https://example.com"],
      code: `Cesium.GeoJsonDataSource.load("https://example.com/data.geojson", {}).then((dataSource) => {
        viewer.dataSources.add(dataSource);
      });`,
    });

    expect(outcome.success).toBe(true);
    expect(viewer.dataSources.add).toHaveBeenCalledTimes(1);
  });

  test("times out a stalled dynamically bridged Promise", async () => {
    const viewer = fakeViewer();
    viewer.scene.pickAsync.mockImplementationOnce(() => new Promise(() => {}));

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      timeoutMs: 50,
      code: `return await viewer.scene.pickAsync({ x: 1, y: 2 });`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/timed out|interrupted/i);
  });

  test("rejects a second dynamically bridged Promise without triggering the upstream QuickJS Asyncify crash", async () => {
    const viewer = fakeViewer();
    viewer.scene.pickAsync.mockRejectedValueOnce(new Error("second pick failed"));

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const first = await viewer.scene.sampleHeightMostDetailed([{ longitude: 1, latitude: 2 }]);
        return await viewer.scene.pickAsync({ x: 1, y: 2 });
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/second pick failed/);
    expect(viewer.scene.sampleHeightMostDetailed).toHaveBeenCalledTimes(1);
  });

  test("blocks absolute URL arguments passed through allowed Cesium loaders by default", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return await Cesium.GeoJsonDataSource.load("https://example.com/data.geojson");`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(
      /network access to origin "https:\/\/example\.com" is not allowed/i,
    );
    expect(GeoJsonDataSource.load).not.toHaveBeenCalled();
  });

  test("allows URL arguments whose exact origin is explicitly configured", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      allowedNetworkOrigins: ["https://example.com"],
      code: `return await Cesium.GeoJsonDataSource.load("https://example.com/data.geojson");`,
    });

    expect(outcome.success).toBe(true);
    expect(GeoJsonDataSource.load).toHaveBeenCalledTimes(1);
  });

  test("blocks relative URL arguments unless explicitly enabled", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return await Cesium.GeoJsonDataSource.load("/api/private-data");`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/relative network URL .* is not allowed/i);
    expect(GeoJsonDataSource.load).not.toHaveBeenCalled();
  });

  test("rejects ambiguous protocol-relative URL arguments", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      allowedNetworkOrigins: ["https://example.com"],
      code: `return await Cesium.GeoJsonDataSource.load("//example.com/data.geojson");`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/protocol-relative network URL .* is not allowed/i);
    expect(GeoJsonDataSource.load).not.toHaveBeenCalled();
  });

  // `Resource` is deliberately present in `BLOCKED_STATIC_CESIUM_EXPORTS` — every one of its
  // static methods below issues (or would issue)
  // real HTTP requests, including mutating verbs (`post`/`put`/`patch`/`delete`), and every
  // `Resource.*` path is tracked only as a "declaration-only" candidate in
  // `CESIUM_COMPATIBILITY.md`, never as runtime-covered. Banning `fetch` and every network
  // primitive outright (not just restricting it to a domain allowlist) is a deliberate security
  // control (see `docs/Codegen-tool-security-attacks-vectors.md`), so these are regression tests
  // proving each method stays unreachable rather than dynamic-bridge coverage tests.
  test.each([
    ["Resource.delete", `Cesium.Resource.delete({ url: "https://example.com/data.json" })`],
    ["Resource.fetch", `Cesium.Resource.fetch({ url: "https://example.com/data.json" })`],
    [
      "Resource.fetchArrayBuffer",
      `Cesium.Resource.fetchArrayBuffer({ url: "https://example.com/data.bin" })`,
    ],
    ["Resource.fetchBlob", `Cesium.Resource.fetchBlob({ url: "https://example.com/data.bin" })`],
    ["Resource.fetchImage", `Cesium.Resource.fetchImage({ url: "https://example.com/image.png" })`],
    ["Resource.fetchJson", `Cesium.Resource.fetchJson({ url: "https://example.com/data.json" })`],
    ["Resource.fetchJsonp", `Cesium.Resource.fetchJsonp({ url: "https://example.com/data.json" })`],
    ["Resource.fetchText", `Cesium.Resource.fetchText({ url: "https://example.com/data.txt" })`],
    ["Resource.fetchXML", `Cesium.Resource.fetchXML({ url: "https://example.com/data.xml" })`],
    ["Resource.head", `Cesium.Resource.head({ url: "https://example.com/data.json" })`],
    ["Resource.options", `Cesium.Resource.options({ url: "https://example.com/data.json" })`],
    [
      "Resource.patch",
      `Cesium.Resource.patch({ url: "https://example.com/data.json" }, { data: "{}" })`,
    ],
    [
      "Resource.post",
      `Cesium.Resource.post({ url: "https://example.com/data.json" }, { data: "{}" })`,
    ],
    [
      "Resource.put",
      `Cesium.Resource.put({ url: "https://example.com/data.json" }, { data: "{}" })`,
    ],
    // `IonResource` extends `Resource` and is likewise deliberately absent from
    // `BLOCKED_STATIC_CESIUM_EXPORTS` — it fetches arbitrary Ion asset content (potentially
    // credentialed, via Ion access tokens) over the network, the same SSRF/data-exfiltration
    // concern as `Resource` itself, so it's excluded for the same reason rather than merely
    // being untested.
    [
      "IonResource.fetchImage",
      `Cesium.IonResource.fetchImage({ url: "https://example.com/image.png" })`,
    ],
    ["IonResource.fromAssetId", `Cesium.IonResource.fromAssetId(12345)`],
  ])("does not expose network-capable %s through the static namespace", async (_path, code) => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return ${code};`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/undefined|null|property/i);
  });

  // `TaskProcessor` is deliberately in `BLOCKED_STATIC_CESIUM_EXPORTS` — it spins up real Web
  // Workers to run arbitrary code/wasm modules, a genuine code-execution escape vector if guest
  // code could reach it. Its own Promise-returning instance methods are therefore provably
  // unreachable by any generated code today (`Cesium.TaskProcessor` always resolves `undefined`
  // through the static-namespace fallback, exactly like `Resource`/`IonResource` above) — these
  // are regression tests proving that stays true, not dynamic-bridge coverage gaps.
  test.each([
    ["TaskProcessor.initWebAssemblyModule", `Cesium.TaskProcessor.initWebAssemblyModule({})`],
    ["TaskProcessor.scheduleTask", `Cesium.TaskProcessor.scheduleTask({})`],
  ])("does not expose blocked-owner %s through the static namespace", async (_path, code) => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return ${code};`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/undefined|null|property/i);
  });

  test("applies a per-run entity cap", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      maxItemsPerCollection: 0,
      code: `return viewer.entities.add({ id: "blocked" });`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/entity cap of 0/i);
    expect(viewer.entities.add).not.toHaveBeenCalled();
  });

  test.each([
    ["viewer.imageryLayers.addImageryProvider({})", "imagery layer"],
    ["viewer.scene.groundPrimitives.add({})", "ground primitive"],
    ["viewer.scene.postProcessStages.add({})", "post-process stage"],
  ])("caps additional scene growth surface %s", async (code, kind) => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      maxItemsPerCollection: 0,
      code: `return ${code};`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(new RegExp(`${kind} cap of 0`, "i"));
  });

  test("preserves optional arguments passed to guarded collection add methods", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return viewer.imageryLayers.addImageryProvider({ id: "provider" }, 2);`,
    });

    expect(outcome.success).toBe(true);
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledWith({ id: "provider" }, 2);
  });

  test("reports a failed host property assignment", async () => {
    const viewer = fakeViewer();
    Object.defineProperty(viewer.scene.globe, "terrainProvider", {
      configurable: true,
      value: undefined,
      writable: false,
    });

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `viewer.scene.globe.terrainProvider = { id: "terrain" };`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/could not assign Cesium property "terrainProvider"/i);
  });

  test("allows a data source whose entity count exactly matches the per-run cap", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      maxItemsPerCollection: 2,
      code: `return viewer.dataSources.add({ entities: { values: [{}, {}] } });`,
    });

    expect(outcome.success).toBe(true);
    expect(viewer.dataSources.add).toHaveBeenCalledTimes(1);
  });

  test("rejects a data source whose own entity count exceeds the per-run cap", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      maxItemsPerCollection: 1,
      code: `return viewer.dataSources.add({ entities: { values: [{}, {}] } });`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/data source entity cap of 1/i);
    expect(viewer.dataSources.add).not.toHaveBeenCalled();
  });

  test("times out a stalled dynamically bridged Cesium.* factory call", async () => {
    const viewer = fakeViewer();
    // A plain `mockImplementationOnce` here would be unsafe: with such a short `timeoutMs`, the
    // QuickJS interrupt can fire before the guest script ever reaches the
    // `Cesium.createWorldImageryAsync()` call, leaving the queued "once" override unconsumed —
    // `afterEach`'s `vi.clearAllMocks()` doesn't drain pending `mockImplementationOnce` queue
    // entries, so it would silently leak into (and hang) the next test that calls this same mock.
    // A scoped `mockImplementation` explicitly restored in `finally` has no such queue to leak.
    const originalImpl = vi.mocked(createWorldImageryAsync).getMockImplementation();
    vi.mocked(createWorldImageryAsync).mockImplementation(() => new Promise(() => {}));

    try {
      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        timeoutMs: 50,
        code: `return await Cesium.createWorldImageryAsync();`,
      });

      expect(outcome.success).toBe(false);
      expect(outcome.error).toMatch(/timed out|interrupted/i);
    } finally {
      vi.mocked(createWorldImageryAsync).mockImplementation(originalImpl!);
    }
  });

  test("allows both Cesium.createWorldImageryAsync and Cesium.createWorldTerrainAsync in the same script", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const imagery = await Cesium.createWorldImageryAsync();
        const terrain = await Cesium.createWorldTerrainAsync();
        return { imagery: imagery.kind, terrain: terrain.kind };
      `,
    });

    expect(outcome).toEqual({
      success: true,
      result: { imagery: "imageryProvider", terrain: "terrainProvider" },
    });
    expect(createWorldImageryAsync).toHaveBeenCalledTimes(1);
    expect(createWorldTerrainAsync).toHaveBeenCalledTimes(1);
  });

  // Regression test for `guarded-viewer-proxy.ts`'s `createGuardedProxy`: a real CesiumJS
  // accessor setter (`Viewer.prototype.trackedEntity`) internally does
  // `this._cesiumWidget.trackedEntity = value`. Without an explicit `set` trap forwarding
  // `receiver = t` (the real target), the Proxy's default set semantics invoke that setter with
  // `this` = the guarded Proxy itself, so its own internal `this._cesiumWidget` read re-enters
  // the same Proxy's `get` trap and trips `assertSandboxPropertyAllowed("_cesiumWidget")` \u2014
  // exactly the reported "Cesium sandbox access to \"_cesiumWidget\" is not allowed." error.
  test("assigning viewer.trackedEntity does not trip the sandbox's own underscore-property guard", async () => {
    const viewer = fakeViewer();
    viewer.entities.add({ id: "plane" });

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const planeEntity = viewer.entities.values.find((e) => e.id === "plane");
        viewer.trackedEntity = planeEntity;
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(viewer.trackedEntity).toMatchObject({ id: "plane" });
  });

  describe("logger option", () => {
    function fakeLogger() {
      return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    }

    test("defaults to silent (no logger provided touches nothing)", async () => {
      const viewer = fakeViewer();

      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code: `return viewer.entities.add({ id: "e1" });`,
      });

      expect(outcome.success).toBe(true);
    });

    test("reports run start/success and individual host-bridge get/set/apply/construct calls", async () => {
      const viewer = fakeViewer();
      const logger = fakeLogger();

      // `viewer.scene.globe` is a real class instance (`FakeGlobe`) in the fixture, so assigning
      // `.terrainProvider` on it actually crosses the guest/host `set` trap (unlike a plain
      // object literal, which `SandboxHandles.isPlainData` flattens to an inert local copy).
      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        logger,
        code: `
          const destination = await Cesium.Cartesian3.fromDegrees(0, 0, 0);
          const entity = await viewer.entities.add({ position: destination });
          viewer.scene.globe.terrainProvider = entity;
          return "done";
        `,
      });

      expect(outcome).toEqual({ success: true, result: "done" });
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/^Starting sandbox run/));
      expect(logger.debug).toHaveBeenCalledWith("Sandbox run completed successfully");
      // At least one `get`/`apply`/`construct`/`set` host-bridge call must have been logged too.
      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/^get "/));
      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/^apply on handle/));
      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/^set "terrainProvider"/));
    });

    test("reports a failed run via logger.error and a blocked property via logger.warn", async () => {
      const viewer = fakeViewer();
      const logger = fakeLogger();

      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        logger,
        code: `return viewer.scene.canvas;`,
      });

      expect(outcome.success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/^Sandbox run failed:/));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/^get "canvas".*not allowed/));
    });
  });
});
