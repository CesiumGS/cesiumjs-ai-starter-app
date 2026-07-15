import { describe, expect, test, vi } from "vitest";
import {
  Cartesian3,
  CesiumTerrainProvider,
  Color,
  GeoJsonPrimitive,
  Ion,
  ScreenSpaceEventType,
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
 *  - a bare native constructor reference (e.g. `Number`) can never cross the JSON marshaling
 *    boundary as a real function — it silently becomes `null`.
 *  - a guest-defined callback passed into a bound host method (e.g.
 *    `ScreenSpaceEventHandler.prototype.setInputAction`) never survives the boundary either, for
 *    the same reason — there is no guest->host callback bridge, only host->guest data returns.
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

function fakeViewer() {
  const entitiesById = new Map<string, unknown>();
  let nextId = 0;

  return {
    camera: {
      setView: vi.fn(),
      flyTo: vi.fn(),
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
    },
    imageryLayers: {
      addImageryProvider: vi.fn((provider: unknown) => ({ provider })),
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

  test("cesiumjs-time-properties: KNOWN GAP — new Cesium.SampledProperty(Number) fails because a bare native constructor can't cross the JSON marshaling boundary", async () => {
    const viewer = fakeViewer();

    // Real-world generated code for "time-dynamic property" almost always looks exactly like
    // this (`new Cesium.SampledProperty(Number)`) — `Number`/`String`/`Boolean` are guest-native
    // global functions with no `__isCesiumRemoteProxy__` marker, so `__marshalArg__` falls through
    // to its final `return value` branch, and the outer `JSON.stringify` of the args array then
    // silently drops the function value entirely (arrays serialize a function element as `null`).
    // The host receives `null` where it expected the `Number` constructor, and Cesium's own
    // `Check.defined("type", type)` guard at the top of the real `SampledProperty` constructor
    // rejects it. This is a real, currently-unfixed gap in this sandbox's marshaling design (no
    // guest->host support for passing along language-level constructor references) — not a model
    // mistake, and not something `assertSandboxPropertyAllowed` is meant to catch.
    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const property = new Cesium.SampledProperty(Number);
        return "created";
      `,
    });

    expect(outcome.success).toBe(false);
  });

  test("cesiumjs-interaction: KNOWN GAP — a guest callback passed into screenSpaceEventHandler.setInputAction never reaches the host as a callable", async () => {
    const viewer = fakeViewer();

    // Real-world generated code registers click handlers on the `Viewer`'s own pre-built
    // `screenSpaceEventHandler` rather than constructing a new one (which would need
    // `viewer.scene.canvas` — deliberately in `BLOCKED_SANDBOX_PROPERTIES` as a DOM-escape guard).
    // But the guest-defined callback closure hits the exact same "function crossing the JSON
    // boundary" problem as the `SampledProperty(Number)` case above: there is no guest->host
    // callback bridge in this design (only host->guest data returns) — `__marshalArg__` leaves a
    // plain function value untagged, and the outer `JSON.stringify` of the args array then
    // silently drops it to `null`. The real host-side handler ends up with `null` stored as its
    // click action instead of the intended callback — silently, with no thrown error. Generated
    // "on click, do X" code therefore currently can never actually run its handler body when a
    // user later clicks.
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

    expect(outcome).toEqual({ success: true, result: "registered" });
    expect(viewer.screenSpaceEventHandler.setInputAction).toHaveBeenCalledTimes(1);
    const [passedAction, passedType] = viewer.screenSpaceEventHandler.setInputAction.mock.calls[0];
    // The intended callback never survives the boundary — it silently arrives as `null`.
    expect(passedAction).toBeNull();
    expect(passedType).toBe(ScreenSpaceEventType.LEFT_CLICK);
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
});
