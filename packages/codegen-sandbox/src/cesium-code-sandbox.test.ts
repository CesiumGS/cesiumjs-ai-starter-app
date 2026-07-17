import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ArcGISTiledElevationTerrainProvider,
  Cartesian3,
  Cesium3DTileset,
  Cesium3DTileStyle,
  CesiumTerrainProvider,
  createOsmBuildingsAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
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
    },
    CesiumTerrainProvider: {
      ...actual.CesiumTerrainProvider,
      fromIonAssetId: vi.fn(async (assetId: unknown, options?: unknown) => ({
        kind: "terrainProvider",
        assetId,
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
  };
});

// A minimal class (not a plain `{}` object literal) standing in for real Cesium's `Globe` class
// instance — `SandboxHandles.isPlainData` distinguishes a real class instance (opaque handle,
// correctly proxied for property assignment) from inert plain JSON data (flattened to a
// snapshot), and every real CesiumJS class instance has a non-`Object.prototype` prototype.
class FakeGlobe {
  terrainProvider: unknown;
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

function fakeViewer() {
  const entitiesById = new Map<string, unknown>();
  let nextId = 0;
  // Created once per `fakeViewer()` call (not inside `get`'s callback) so every call to
  // `imageryLayers.get(0)` \u2014 both from generated code and from a test's later assertion \u2014
  // resolves to the SAME fake layer/provider instance, matching the existing `terrainProvider`
  // pattern above.
  const arcGisImageryLayer = { imageryProvider: new FakeArcGisMapServerImageryProvider() as unknown };

  return {
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
      get: vi.fn((_index: number) => arcGisImageryLayer),
    },
    scene: {
      clampToHeightMostDetailed: vi.fn(async (positions: unknown[]) => positions),
      pickAsync: vi.fn(async (position: unknown) => ({ kind: "pick", position })),
      sampleHeightMostDetailed: vi.fn(async (positions: unknown[]) => positions),
      primitives: {
        length: 0,
        add: vi.fn((primitive: unknown) => primitive),
        remove: vi.fn(),
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
    path: "Scene.sampleHeightMostDetailed",
    code: `return await viewer.scene.sampleHeightMostDetailed([{ longitude: 1, latitude: 2 }]);`,
    expected: [{ longitude: 1, latitude: 2 }],
    getMock: (viewer: ReturnType<typeof fakeViewer>) =>
      viewer.scene.sampleHeightMostDetailed,
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
] as const;

const dynamicPromiseGapPaths = [
  "Scene.clampToHeightMostDetailed",
  "Scene.pickAsync",
] as const;

afterEach(() => {
  vi.clearAllMocks();
});

describe("runCesiumCodeInSandbox", () => {
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

  test("loads OSM buildings via the bare Cesium.createOsmBuildingsAsync alias and adds them to scene.primitives", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const tileset = await createOsmBuildingsAsync();
        await viewer.scene.primitives.add(tileset);
        return "added";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "added" });
    expect(createOsmBuildingsAsync).toHaveBeenCalledTimes(1);
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  test("loads a 3D Tileset by URL and adds it to scene.primitives", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const tileset = await Cesium.Cesium3DTileset.fromUrl("https://example.com/tileset.json");
        await viewer.scene.primitives.add(tileset);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(Cesium3DTileset.fromUrl).toHaveBeenCalledWith(
      "https://example.com/tileset.json",
      undefined,
    );
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  test("loads a 3D Tileset by Ion asset id and styles it via property assignment (tileset.style = ...)", async () => {
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
    expect(Cesium3DTileset.fromIonAssetId).toHaveBeenCalledWith(75343, undefined);
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
    expect(CesiumTerrainProvider.fromIonAssetId).toHaveBeenCalledWith(1, undefined);
    expect((viewer.scene.globe.terrainProvider as { kind: string }).kind).toBe("terrainProvider");
  });

  test("loads an ArcGIS tiled elevation terrain provider by URL and assigns it via viewer.terrainProvider = ...", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
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
  // provider (a second, genuinely async CesiumJS action) in its own run doesn't hit the
  // one-async-call-per-script guard — that guard is scoped to a single generated script, not
  // across separate sandboxed runs.
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
    expect(dynamicPromiseCases.map(({ path }) => path).sort()).toEqual(
      [...CESIUM_DYNAMIC_PROMISE_RUNTIME_COVERAGE].sort(),
    );
    expect([...dynamicPromiseGapPaths].sort()).toEqual(
      [...CESIUM_DYNAMIC_PROMISE_RUNTIME_GAPS].sort(),
    );
  });

  test.todo("dynamically bridges Scene.clampToHeightMostDetailed without an Asyncify hang");
  test.todo("dynamically bridges Scene.pickAsync without an Asyncify hang");

  test.each(dynamicPromiseCases)(
    "dynamically bridges $path through an allowed host handle",
    async ({ code, expected, getMock }) => {
      const viewer = fakeViewer();

      const outcome = await runCesiumCodeInSandbox({ viewer: viewer as never, code });

      expect(outcome).toEqual({ success: true, result: expected });
      expect(getMock(viewer)).toHaveBeenCalledTimes(1);
    },
  );

  test.todo(
    "returns a rejected dynamically bridged Promise without triggering the upstream QuickJS Asyncify crash",
  );

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

  test.todo(
    "rejects a second dynamically bridged Promise without triggering the upstream QuickJS Asyncify crash",
  );

  test("does not expose network-capable Cesium.Resource through the static namespace", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `return Cesium.Resource.fetchJson({ url: "https://example.com/data.json" });`,
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

  test("times out a stalled explicitly bound async factory", async () => {
    const viewer = fakeViewer();
    vi.mocked(createWorldImageryAsync).mockImplementationOnce(
      () =>
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("late factory failure")), 1500),
        ),
    );

    const startedAt = Date.now();
    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      timeoutMs: 1000,
      code: `return await Cesium.createWorldImageryAsync();`,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/timed out|interrupted/i);
    expect(createWorldImageryAsync).toHaveBeenCalledTimes(1);
    expect(Date.now() - startedAt).toBeLessThan(1400);
  });

  test("rejects a second async CesiumJS call in the same script (Asyncify one-call-per-script guard)", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        await Cesium.createWorldImageryAsync();
        await Cesium.createWorldTerrainAsync();
        return "unreachable";
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/only one async cesiumjs call/i);
    expect(createWorldImageryAsync).toHaveBeenCalledTimes(1);
    expect(createWorldTerrainAsync).not.toHaveBeenCalled();
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
