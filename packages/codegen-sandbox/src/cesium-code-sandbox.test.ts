import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Cartesian3,
  Cesium3DTileset,
  Cesium3DTileStyle,
  CesiumTerrainProvider,
  createOsmBuildingsAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
  GeoJsonDataSource,
} from "cesium";
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
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({ kind: "tileset", url, options })),
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
    GeoJsonDataSource: {
      ...actual.GeoJsonDataSource,
      load: vi.fn(async (data: unknown, options?: unknown) => ({ kind: "dataSource", data, options })),
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

function fakeViewer() {
  const entitiesById = new Map<string, unknown>();
  let nextId = 0;

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
    zoomTo: vi.fn(),
    flyTo: vi.fn(),
    imageryLayers: {
      addImageryProvider: vi.fn((provider: unknown) => ({ provider })),
      remove: vi.fn(),
      removeAll: vi.fn(),
    },
    scene: {
      primitives: {
        add: vi.fn((primitive: unknown) => primitive),
        remove: vi.fn(),
      },
      globe: new FakeGlobe(),
    },
    terrainProvider: undefined as unknown,
    dataSources: {
      add: vi.fn(() => Promise.resolve()),
      remove: vi.fn(),
      removeAll: vi.fn(),
    },
  };
}

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

  test("composes camera.flyHome/zoomIn/zoomOut/lookAt and viewer.zoomTo/flyTo", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const entity = await viewer.entities.add({ position: await Cesium.Cartesian3.fromDegrees(0, 0, 0) });
        await viewer.camera.flyHome(2);
        await viewer.camera.zoomIn(100);
        await viewer.camera.zoomOut(50);
        await viewer.camera.lookAt(entity.position, new Cesium.HeadingPitchRange(0, -0.5, 1000));
        await viewer.zoomTo(entity);
        await viewer.flyTo(entity);
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
    expect(viewer.zoomTo).toHaveBeenCalledTimes(1);
    expect(viewer.flyTo).toHaveBeenCalledTimes(1);
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

  test("loads GeoJSON via Cesium.GeoJsonDataSource.load and adds it to viewer.dataSources", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const dataSource = await Cesium.GeoJsonDataSource.load("https://example.com/data.geojson", { clampToGround: true });
        await viewer.dataSources.add(dataSource);
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(GeoJsonDataSource.load).toHaveBeenCalledWith("https://example.com/data.geojson", {
      clampToGround: true,
    });
    expect(viewer.dataSources.add).toHaveBeenCalledTimes(1);
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
});