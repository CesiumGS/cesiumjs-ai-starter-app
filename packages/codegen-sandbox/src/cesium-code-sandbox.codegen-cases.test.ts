import { describe, expect, test, vi } from "vitest";
import {
  ArcGisBaseMapType,
  ArcGisMapServerImageryProvider,
  Cartesian3,
  CesiumTerrainProvider,
  Color,
  GeoJsonPrimitive,
  Ion,
  ModelAnimationLoop,
  WebMapServiceImageryProvider,
} from "cesium";
import { runCesiumCodeInSandbox } from "./cesium-code-sandbox.js";

/**
 * Imitates realistic LLM-generated `executeCesiumCode` snippets across (most of) the same
 * CesiumJS domains exercised by `e2e/execute-cesium-code-domains-live.spec.ts`'s `DOMAIN_INTENTS`
 * (camera, viewer-setup, entities, spatial-math, imagery, primitives, time-properties,
 * interaction, terrain-environment, core-utilities, materials-shaders, custom-shader,
 * models-particles), and asks the same question for each: **can the QuickJS-wasm sandbox actually
 * run code that looks like this?**
 *
 * Unlike `cesium-code-sandbox.test.ts` (which exercises individual bound primitives in
 * isolation), this file's cases are meant to look like a whole snippet a model would plausibly
 * write for a given domain intent, composing several bound APIs together. A handful of cases
 * (clearly marked "KNOWN GAP" / "KNOWN NODE-ENV LIMITATION") intentionally assert a *failure* —
 * documenting real, currently-unfixed boundaries of this sandbox design (found while writing
 * this suite) rather than papering over them:
 *
 *  - `Number`, `String`, and `Boolean` constructor references cross through explicit tags.
 *  - guest-defined callbacks are rejected explicitly because they cannot outlive the disposable
 *    guest VM; they are never silently converted to `null`.
 *  - anything that genuinely needs a browser `document`/canvas (`PinBuilder.fromColor`) cannot
 *    run under Vitest's Node environment at all — this is a real environment limitation of this
 *    *test*, not a bug in the sandbox itself (the real browser sandbox handles it fine — see the
 *    `cesiumjs-core-utilities` entry in `execute-cesium-code-domains-live.spec.ts`).
 *
 * All cases use a fake `Viewer`/async-factories double (never the network/Ion/a real DOM), same
 * as `cesium-code-sandbox.test.ts`.
 */

// A minimal class (not a plain `{}` object literal) standing in for real Cesium's `Globe` class
// instance — see the identical comment in `cesium-code-sandbox.test.ts` for why this must not be
// a plain object literal (`SandboxHandles.isPlainData` would otherwise flatten it to an inert
// snapshot instead of a live proxied handle).
class FakeGlobe {
  terrainProvider: unknown;
}

/**
 * A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
 * `FakeGlobe`) standing in for real Cesium's `viewer.screenSpaceEventHandler` — the `Viewer`'s
 * own pre-built handler, which real-world generated code uses directly rather than constructing
 * a new one against `viewer.scene.canvas` (which is, deliberately, in `BLOCKED_SANDBOX_PROPERTIES`
 * — `canvas` would otherwise be an escape hatch to the real DOM).
 */
class FakeScreenSpaceEventHandler {
  setInputAction = vi.fn();
  getInputAction = vi.fn();
}

/**
 * A minimal class (not a plain `{}` object literal, for the same `isPlainData` reason as
 * `FakeGlobe`) standing in for a real `ArcGisMapServerImageryProvider` instance reached via
 * `viewer.imageryLayers.get(index).imageryProvider` — `requestImage`/`pickFeatures` are genuinely
 * Promise-returning instance methods with no named async binding of their own, so calling them on
 * an already-reachable handle (seeded directly on the fake `Viewer`, not obtained via
 * `fromUrl`/`fromBasemapType` in the SAME generated script — that would consume the one allowed
 * async CesiumJS call per script before ever reaching these) exercises the generic dynamic Promise
 * bridge instead.
 */
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
  // Created once per `fakeViewer()` call (not inside a per-call callback) so every call to
  // `imageryLayers.get(0)` — both from generated code and from a test's later assertion —
  // resolves to the SAME fake layer/provider instance.
  const arcGisImageryLayer = { imageryProvider: new FakeArcGisMapServerImageryProvider() as unknown };

  return {
    camera: {
      setView: vi.fn(),
      flyTo: vi.fn(),
      flyToBoundingSphere: vi.fn(),
      positionCartographic: { latitude: 0.8527, longitude: 0.041, height: 1000 },
    },
    flyTo: vi.fn(async (_entity: unknown, _options?: unknown) => true),
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
    },
    imageryLayers: {
      addImageryProvider: vi.fn((provider: unknown) => ({ provider })),
      get: vi.fn((_index: number) => arcGisImageryLayer),
    },
    scene: {
      primitives: {
        add: vi.fn((primitive: unknown) => primitive),
      },
      globe: new FakeGlobe(),
      pick: vi.fn(),
      morphToColumbusView: vi.fn(),
    },
    dataSources: {
      add: vi.fn(() => Promise.resolve()),
    },
    screenSpaceEventHandler: new FakeScreenSpaceEventHandler(),
  };
}

vi.mock("cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("cesium")>();
  return {
    ...actual,
    CesiumTerrainProvider: {
      ...actual.CesiumTerrainProvider,
      fromIonAssetId: vi.fn(async (assetId: unknown) => ({
        kind: "terrainProvider",
        assetId,
      })),
    },
    // Unlike `CesiumTerrainProvider` above (mocked via a plain-object spread), the async
    // `ArcGisMapServerImageryProvider.fromUrl`/`.fromBasemapType` factories are also reached
    // through Asyncify-bound guest bindings — mocking them the same way is safe since they're
    // only ever called directly host-side, never crossing the guest boundary as a raw value.
    ArcGisMapServerImageryProvider: {
      ...actual.ArcGisMapServerImageryProvider,
      fromUrl: vi.fn(async (url: unknown, options?: unknown) => ({
        kind: "arcGisImageryProvider",
        url,
        options,
      })),
      fromBasemapType: vi.fn(async (style: unknown, options?: unknown) => ({
        kind: "arcGisImageryProvider",
        style,
        options,
      })),
    },
  };
});

describe("runCesiumCodeInSandbox — imitated codegen cases by domain", () => {
  test("cesiumjs-camera: instant heading/pitch/roll snap via Camera.setView", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const destination = await Cesium.Cartesian3.fromDegrees(-112.1401, 36.0544, 5000);
        await viewer.camera.setView({
          destination,
          orientation: {
            heading: Cesium.Math.toRadians(30),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0,
          },
        });
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(viewer.camera.setView).toHaveBeenCalledTimes(1);
    const passedOptions = viewer.camera.setView.mock.calls[0][0] as {
      destination: { x: number; y: number; z: number };
      orientation: { heading: number; pitch: number; roll: number };
    };
    const expectedDestination = Cartesian3.fromDegrees(-112.1401, 36.0544, 5000);
    expect(passedOptions.destination.x).toBeCloseTo(expectedDestination.x, 2);
    expect(passedOptions.destination.y).toBeCloseTo(expectedDestination.y, 2);
    expect(passedOptions.destination.z).toBeCloseTo(expectedDestination.z, 2);
    expect(passedOptions.orientation.heading).toBeCloseTo(Math.PI / 6, 5);
    expect(passedOptions.orientation.pitch).toBeCloseTo(-Math.PI / 3, 5);
    expect(passedOptions.orientation.roll).toBe(0);
  });

  test("cesiumjs-viewer-setup: Scene.morphToColumbusView + confirms Cesium.Ion.defaultAccessToken is configured", async () => {
    const previousToken = Ion.defaultAccessToken;
    Ion.defaultAccessToken = "test-ion-token";
    try {
      const viewer = fakeViewer();

      const outcome = await runCesiumCodeInSandbox({
        viewer: viewer as never,
        code: `
          await viewer.scene.morphToColumbusView(2.0);
          const tokenConfigured =
            typeof Cesium.Ion.defaultAccessToken === "string" && Cesium.Ion.defaultAccessToken.length > 0;
          return { tokenConfigured };
        `,
      });

      expect(outcome).toEqual({ success: true, result: { tokenConfigured: true } });
      expect(viewer.scene.morphToColumbusView).toHaveBeenCalledWith(2.0);
    } finally {
      Ion.defaultAccessToken = previousToken;
    }
  });

  test("cesiumjs-entities: add a GeoJSON-shaped polygon entity with a label using the high-level Entity API", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const hierarchy = await Cesium.Cartesian3.fromDegreesArray([
          -109, 37, -102, 37, -102, 41, -109, 41, -109, 37,
        ]);
        const entity = await viewer.entities.add({
          polygon: {
            hierarchy,
            material: Cesium.Color.RED.withAlpha(0.5),
          },
          label: {
            text: "Colorado",
            font: "14pt sans-serif",
            fillColor: Cesium.Color.WHITE,
          },
        });
        return entity.label.text;
      `,
    });

    expect(outcome).toEqual({ success: true, result: "Colorado" });
    expect(viewer.entities.add).toHaveBeenCalledTimes(1);
    const passedOptions = viewer.entities.add.mock.calls[0][0] as {
      polygon: { hierarchy: unknown[]; material: Color };
    };
    expect(passedOptions.polygon.hierarchy).toHaveLength(5);
    expect(passedOptions.polygon.material).toBeInstanceOf(Color);
    expect(passedOptions.polygon.material.alpha).toBeCloseTo(0.5, 5);
  });

  test("cesiumjs-spatial-math: converts Cartesian3 -> Cartographic via Ellipsoid.WGS84.cartesianToCartographic", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const cartesian = await Cesium.Cartesian3.fromDegrees(2.3522, 48.8566, 1000);
        const cartographic = await Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
        return {
          longitudeDeg: Cesium.Math.toDegrees(cartographic.longitude),
          latitudeDeg: Cesium.Math.toDegrees(cartographic.latitude),
          height: cartographic.height,
        };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { longitudeDeg: number; latitudeDeg: number; height: number };
    expect(result.longitudeDeg).toBeCloseTo(2.3522, 2);
    expect(result.latitudeDeg).toBeCloseTo(48.8566, 2);
    expect(result.height).toBeCloseTo(1000, 0);
  });

  test("cesiumjs-imagery: constructs a real WebMapServiceImageryProvider and adds it via viewer.imageryLayers.addImageryProvider", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const provider = new Cesium.WebMapServiceImageryProvider({
          url: "https://example.com/wms",
          layers: "world:layer1",
        });
        const layer = await viewer.imageryLayers.addImageryProvider(provider);
        return layer !== null;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledTimes(1);
    const passedProvider = viewer.imageryLayers.addImageryProvider.mock.calls[0][0];
    expect(passedProvider).toBeInstanceOf(WebMapServiceImageryProvider);
  });

  test("cesiumjs-imagery: adds a default ArcGIS basemap layer via ArcGisMapServerImageryProvider.fromBasemapType", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const provider = await Cesium.ArcGisMapServerImageryProvider.fromBasemapType(
          Cesium.ArcGisBaseMapType.SATELLITE,
        );
        const layer = await viewer.imageryLayers.addImageryProvider(provider);
        return layer !== null;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(ArcGisMapServerImageryProvider.fromBasemapType).toHaveBeenCalledWith(
      ArcGisBaseMapType.SATELLITE,
    );
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledTimes(1);
    const passedProvider = viewer.imageryLayers.addImageryProvider.mock.calls[0][0] as {
      kind: string;
    };
    expect(passedProvider.kind).toBe("arcGisImageryProvider");
  });

  test("cesiumjs-imagery: constructs an ArcGIS MapServer imagery provider directly from a URL via ArcGisMapServerImageryProvider.fromUrl", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        );
        const layer = await viewer.imageryLayers.addImageryProvider(provider);
        return layer !== null;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(ArcGisMapServerImageryProvider.fromUrl).toHaveBeenCalledWith(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      undefined,
    );
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledTimes(1);
  });

  test("cesiumjs-imagery: requests a single tile image via ArcGisMapServerImageryProvider.requestImage (generic dynamic Promise bridge, no dedicated async binding)", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const layer = viewer.imageryLayers.get(0);
        return await layer.imageryProvider.requestImage(2, 3, 5);
      `,
    });

    expect(outcome).toEqual({
      success: true,
      result: { kind: "imageryTile", x: 2, y: 3, level: 5 },
    });
    const layer = viewer.imageryLayers.get(0) as {
      imageryProvider: { requestImage: (...args: unknown[]) => unknown };
    };
    expect(layer.imageryProvider.requestImage).toHaveBeenCalledWith(2, 3, 5);
  });

  test("cesiumjs-imagery: picks features at a clicked tile via ArcGisMapServerImageryProvider.pickFeatures (generic dynamic Promise bridge)", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const layer = viewer.imageryLayers.get(0);
        return await layer.imageryProvider.pickFeatures(2, 3, 5, 12.5, 41.9);
      `,
    });

    expect(outcome).toEqual({
      success: true,
      result: [{ kind: "featureInfo", x: 2, y: 3, level: 5, longitude: 12.5, latitude: 41.9 }],
    });
    const layer = viewer.imageryLayers.get(0) as {
      imageryProvider: { pickFeatures: (...args: unknown[]) => unknown };
    };
    expect(layer.imageryProvider.pickFeatures).toHaveBeenCalledWith(2, 3, 5, 12.5, 41.9);
  });

  test("cesiumjs-primitives: builds a real GeoJsonPrimitive from inline GeoJSON and adds it to scene.primitives", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const geoJson = {
          type: "Polygon",
          coordinates: [[[-109, 37], [-102, 37], [-102, 41], [-109, 41], [-109, 37]]],
        };
        const primitive = await Cesium.GeoJsonPrimitive.fromGeoJson(geoJson, { clampToGround: true });
        await viewer.scene.primitives.add(primitive);
        return "added";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "added" });
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
    expect(viewer.scene.primitives.add.mock.calls[0][0]).toBeInstanceOf(GeoJsonPrimitive);
  });

  test("cesiumjs-time-properties: JulianDate arithmetic (fromIso8601/addSeconds/secondsDifference) works entirely via the static-namespace bridge", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const start = await Cesium.JulianDate.fromIso8601("2024-01-01T00:00:00Z");
        const later = await Cesium.JulianDate.addSeconds(start, 3600, new Cesium.JulianDate());
        return await Cesium.JulianDate.secondsDifference(later, start);
      `,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.result).toBeCloseTo(3600, 5);
  });

  test("cesiumjs-time-properties: passes a supported native constructor to Cesium.SampledProperty", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const property = new Cesium.SampledProperty(Number);
        return "created";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "created" });
  });

  test("cesiumjs-interaction: explicitly rejects callbacks that cannot outlive the guest VM", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        viewer.screenSpaceEventHandler.setInputAction(function (movement) {
          const picked = viewer.scene.pick(movement.position);
          return picked;
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        return "registered";
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/guest callbacks cannot cross/i);
    expect(viewer.screenSpaceEventHandler.setInputAction).not.toHaveBeenCalled();
  });

  test("cesiumjs-terrain-environment: sets scene.globe.terrainProvider from CesiumTerrainProvider.fromIonAssetId(1)", async () => {
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

  test("cesiumjs-core-utilities: KNOWN NODE-ENV LIMITATION — PinBuilder.fromColor needs a real DOM canvas, unavailable under Vitest's node environment", async () => {
    const viewer = fakeViewer();

    // `PinBuilder.fromColor`/`.fromText` synchronously call `document.createElement("canvas")`
    // internally (verified by reading `node_modules/cesium`'s built source directly). This
    // repo's `vitest.config.ts` runs with `environment: "node"` (no `document` global at all), so
    // this specific call can never succeed in THIS test process — the real browser sandbox
    // handles it correctly (confirmed passing live via the `cesiumjs-core-utilities` domain in
    // `execute-cesium-code-domains-live.spec.ts`). This test documents that boundary rather than
    // asserting a false "it works everywhere".
    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const pinBuilder = new Cesium.PinBuilder();
        const canvas = pinBuilder.fromColor(Cesium.Color.RED, 48);
        return canvas !== null;
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/document/i);
  });

  test("cesiumjs-materials-shaders: KNOWN NODE-ENV LIMITATION — new Cesium.Material(...) references the browser-only HTMLCanvasElement global even before any real GL context exists", async () => {
    const viewer = fakeViewer();

    // Real Cesium's `Material` constructor checks uniform values with `instanceof
    // HTMLCanvasElement` while validating/normalizing its Fabric definition — `HTMLCanvasElement`
    // is a browser global that simply doesn't exist under Vitest's `environment: "node"`, so this
    // throws a `ReferenceError` immediately, before any WebGL/rendering is even involved. Same
    // class of Node-only test-environment limitation as the `PinBuilder`/`document` case above,
    // not a sandbox bug — the real browser sandbox handles Material construction fine.
    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const material = new Cesium.Material({
          fabric: {
            type: "CustomStripe",
            uniforms: { color: Cesium.Color.CYAN },
            source:
              "czm_material czm_getMaterial(czm_materialInput materialInput) { czm_material m = czm_getDefaultMaterial(materialInput); m.diffuse = color.rgb; return m; }",
          },
        });
        return typeof material.shaderSource === "string" && material.shaderSource.length > 0;
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/HTMLCanvasElement/i);
  });

  test("cesiumjs-custom-shader: constructs a real CustomShader from fragmentShaderText without needing a WebGL context", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const shader = new Cesium.CustomShader({
          fragmentShaderText:
            "void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { material.diffuse = vec3(1.0, 0.0, 0.0); }",
        });
        return shader.fragmentShaderText.length > 0;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
  });

  test("cesiumjs-models-particles: constructs a real ParticleSystem and adds it to scene.primitives (config-only, no WebGL needed until update())", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const particleSystem = new Cesium.ParticleSystem({
          image: "https://example.com/fire.png",
          startColor: Cesium.Color.RED.withAlpha(0.7),
          endColor: Cesium.Color.YELLOW.withAlpha(0),
          startScale: 1.0,
          endScale: 4.0,
          minimumParticleLife: 1,
          maximumParticleLife: 1.5,
          minimumSpeed: 1,
          maximumSpeed: 4,
          emissionRate: 5,
          lifetime: 16,
        });
        await viewer.scene.primitives.add(particleSystem);
        return particleSystem.emissionRate;
      `,
    });

    expect(outcome).toEqual({ success: true, result: 5 });
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  test("cesiumjs-camera: animated Camera.flyTo with an explicit duration and orientation", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const destination = await Cesium.Cartesian3.fromDegrees(139.6917, 35.6895, 15000);
        await viewer.camera.flyTo({
          destination,
          duration: 3,
          orientation: {
            heading: Cesium.Math.toRadians(90),
            pitch: Cesium.Math.toRadians(-45),
          },
        });
        return "flying";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "flying" });
    expect(viewer.camera.flyTo).toHaveBeenCalledTimes(1);
    const passedOptions = viewer.camera.flyTo.mock.calls[0][0] as {
      duration: number;
      orientation: { heading: number; pitch: number };
    };
    expect(passedOptions.duration).toBe(3);
    expect(passedOptions.orientation.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(passedOptions.orientation.pitch).toBeCloseTo(-Math.PI / 4, 5);
  });

  test("cesiumjs-camera: a `complete` callback on Camera.flyTo is rejected the same as any other guest callback", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const destination = await Cesium.Cartesian3.fromDegrees(0, 0, 1000);
        await viewer.camera.flyTo({
          destination,
          complete: function () {
            return "arrived";
          },
        });
        return "unreachable";
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/guest callbacks cannot cross/i);
    expect(viewer.camera.flyTo).not.toHaveBeenCalled();
  });

  test("cesiumjs-camera: flyToBoundingSphere frames a real BoundingSphere with a HeadingPitchRange offset", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const center = await Cesium.Cartesian3.fromDegrees(-122.4194, 37.7749, 0);
        const boundingSphere = new Cesium.BoundingSphere(center, 5000);
        const offset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(45),
          Cesium.Math.toRadians(-30),
          10000,
        );
        await viewer.camera.flyToBoundingSphere(boundingSphere, { offset, duration: 1.5 });
        return "done";
      `,
    });

    expect(outcome).toEqual({ success: true, result: "done" });
    expect(viewer.camera.flyToBoundingSphere).toHaveBeenCalledTimes(1);
    const [passedSphere, passedOptions] = viewer.camera.flyToBoundingSphere.mock.calls[0] as [
      { center: { x: number; y: number; z: number }; radius: number },
      { offset: { heading: number; pitch: number; range: number }; duration: number },
    ];
    expect(passedSphere.radius).toBe(5000);
    expect(passedOptions.offset.heading).toBeCloseTo(Math.PI / 4, 5);
    expect(passedOptions.offset.range).toBe(10000);
    expect(passedOptions.duration).toBe(1.5);
  });

  test("cesiumjs-entities: adds a polyline entity with a height-per-vertex path and a real Color material", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const positions = await Cesium.Cartesian3.fromDegreesArrayHeights([
          -122.4194, 37.7749, 0,
          -118.2437, 34.0522, 0,
          -73.9857, 40.7484, 0,
        ]);
        const entity = await viewer.entities.add({
          polyline: {
            positions,
            width: 4,
            material: Cesium.Color.DODGERBLUE,
          },
        });
        return entity.polyline.positions.length;
      `,
    });

    expect(outcome).toEqual({ success: true, result: 3 });
    expect(viewer.entities.add).toHaveBeenCalledTimes(1);
    const passedOptions = viewer.entities.add.mock.calls[0][0] as {
      polyline: { positions: unknown[]; width: number; material: Color };
    };
    expect(passedOptions.polyline.positions).toHaveLength(3);
    expect(passedOptions.polyline.width).toBe(4);
    expect(passedOptions.polyline.material).toBeInstanceOf(Color);
  });

  test("cesiumjs-entities: enforces the client-side entity cap once the collection limit is reached", async () => {
    const viewer = fakeViewer();
    // Seeds one pre-existing entity directly (host-side, bypassing the sandbox) so the cap is
    // already at its limit before the generated code runs its own `viewer.entities.add`.
    viewer.entities.add({ id: "seed-entity", point: { pixelSize: 4 } });

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      maxItemsPerCollection: 1,
      code: `
        const position = await Cesium.Cartesian3.fromDegrees(-100, 40, 0);
        await viewer.entities.add({ position });
        return "unreachable";
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/Entity cap of 1 reached/);
    // Only the host-side seed call above, never the sandboxed one — the cap check runs before
    // the real `add` is ever forwarded.
    expect(viewer.entities.add).toHaveBeenCalledTimes(1);
  });

  test("cesiumjs-spatial-math: Cartesian3.distance measures a straight-line distance entirely in-guest (no host round trip)", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const paris = await Cesium.Cartesian3.fromDegrees(2.3522, 48.8566, 0);
        const london = await Cesium.Cartesian3.fromDegrees(-0.1276, 51.5072, 0);
        return Cesium.Cartesian3.distance(paris, london);
      `,
    });

    expect(outcome.success).toBe(true);
    const expectedDistance = Cartesian3.distance(
      Cartesian3.fromDegrees(2.3522, 48.8566, 0),
      Cartesian3.fromDegrees(-0.1276, 51.5072, 0),
    );
    expect(outcome.result).toBeCloseTo(expectedDistance, 5);
  });

  test("cesiumjs-spatial-math: Transforms.eastNorthUpToFixedFrame + Matrix4.getTranslation round-trips a local frame's origin", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const origin = await Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883, 0);
        const frame = await Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        const translation = await Cesium.Matrix4.getTranslation(frame, new Cesium.Cartesian3());
        return { x: translation.x, y: translation.y, z: translation.z };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { x: number; y: number; z: number };
    const expectedOrigin = Cartesian3.fromDegrees(-75.59777, 40.03883, 0);
    expect(result.x).toBeCloseTo(expectedOrigin.x, 2);
    expect(result.y).toBeCloseTo(expectedOrigin.y, 2);
    expect(result.z).toBeCloseTo(expectedOrigin.z, 2);
  });

  test("cesiumjs-core-utilities: Rectangle.fromDegrees + BoundingSphere composition needs no DOM/WebGL", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const rectangle = await Cesium.Rectangle.fromDegrees(-109, 37, -102, 41);
        const center = await Cesium.Rectangle.center(rectangle, new Cesium.Cartographic());
        const centerPosition = await Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, 0);
        const boundingSphere = new Cesium.BoundingSphere(centerPosition, 500000);
        return { west: rectangle.west, radius: boundingSphere.radius };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { west: number; radius: number };
    expect(result.west).toBeCloseTo((-109 * Math.PI) / 180, 5);
    expect(result.radius).toBe(500000);
  });

  test("cesiumjs-time-properties: SampledPositionProperty.addSample builds a moving path, sampled back via entity.position.getValue", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const property = new Cesium.SampledPositionProperty();
        const startTime = await Cesium.JulianDate.fromIso8601("2024-01-01T00:00:00Z");
        const startPosition = await Cesium.Cartesian3.fromDegrees(-75, 40, 100);
        await property.addSample(startTime, startPosition);

        const laterTime = await Cesium.JulianDate.addSeconds(startTime, 10, new Cesium.JulianDate());
        const laterPosition = await Cesium.Cartesian3.fromDegrees(-75.01, 40.01, 200);
        await property.addSample(laterTime, laterPosition);

        const entity = await viewer.entities.add({ position: property });
        const sampled = await entity.position.getValue(startTime);
        return { x: sampled.x, y: sampled.y, z: sampled.z };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { x: number; y: number; z: number };
    const expectedStart = Cartesian3.fromDegrees(-75, 40, 100);
    expect(result.x).toBeCloseTo(expectedStart.x, 1);
    expect(result.y).toBeCloseTo(expectedStart.y, 1);
    expect(result.z).toBeCloseTo(expectedStart.z, 1);
  });

  test("cesiumjs-models-particles: entity model options reference the real Cesium.ModelAnimationLoop enum", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const position = await Cesium.Cartesian3.fromDegrees(-116.52, 35.02, 0);
        const entity = await viewer.entities.add({
          position,
          model: {
            uri: "https://example.com/model.glb",
            animationLoop: Cesium.ModelAnimationLoop.REPEAT,
            minimumPixelSize: 64,
          },
        });
        return entity.model.animationLoop;
      `,
    });

    expect(outcome).toEqual({ success: true, result: ModelAnimationLoop.REPEAT });
    const passedOptions = viewer.entities.add.mock.calls[0][0] as {
      model: { animationLoop: number; minimumPixelSize: number };
    };
    expect(passedOptions.model.minimumPixelSize).toBe(64);
  });

  test("cesiumjs-camera: viewer.flyTo(entity) flies to a just-added entity via the async viewer-method bridge", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const position = await Cesium.Cartesian3.fromDegrees(-87.6298, 41.8781, 0);
        const entity = await viewer.entities.add({ position });
        const arrived = await viewer.flyTo(entity, { duration: 2 });
        return arrived;
      `,
    });

    expect(outcome).toEqual({ success: true, result: true });
    expect(viewer.flyTo).toHaveBeenCalledTimes(1);
    const [passedEntity, passedOptions] = viewer.flyTo.mock.calls[0] as [
      { id: string },
      { duration: number },
    ];
    expect(passedEntity.id).toBeDefined();
    expect(passedOptions.duration).toBe(2);
  });

  test("cesiumjs-terrain-environment: only one async CesiumJS factory call is allowed per generated script", async () => {
    const viewer = fakeViewer();
    const callsBefore = vi.mocked(CesiumTerrainProvider.fromIonAssetId).mock.calls.length;

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const first = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
        const second = await Cesium.CesiumTerrainProvider.fromIonAssetId(2);
        return "unreachable";
      `,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/only one async cesiumjs call/i);
    // Only the first `fromIonAssetId` call actually reaches the mock — the second is rejected by
    // the async-bridge's own call-count guard before ever dispatching to the real factory.
    expect(vi.mocked(CesiumTerrainProvider.fromIonAssetId).mock.calls.length).toBe(callsBefore + 1);
  });
});
