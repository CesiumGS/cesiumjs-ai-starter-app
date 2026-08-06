import { describe, expect, test } from "vitest";
import { ClockRange, Color, EntityCollection, JulianDate } from "cesium";
import type { Entity, Viewer } from "cesium";
import {
  animationCameraTracking,
  animationCreate,
  animationListActive,
  animationRemove,
  animationUpdatePath,
  clockControl,
  globeSetLighting,
} from "./animation.js";

/** Mutable fake `viewer.clock` — plain fields are enough since animation.ts only ever assigns to them. */
interface FakeClock {
  clockRange: ClockRange;
  multiplier: number;
  shouldAnimate: boolean;
  startTime?: unknown;
  stopTime?: unknown;
  currentTime?: unknown;
}

function fakeViewer(): Viewer & { clock: FakeClock } {
  const clock: FakeClock = {
    clockRange: ClockRange.UNBOUNDED,
    multiplier: 1,
    shouldAnimate: false,
  };
  return {
    entities: new EntityCollection(),
    clock,
    trackedEntity: undefined,
  } as unknown as Viewer & { clock: FakeClock };
}

const SAMPLES = [
  { time: "2024-01-01T00:00:00Z", longitude: 0, latitude: 0 },
  { time: "2024-01-01T00:01:00Z", longitude: 1, latitude: 1 },
];

/** Runs `animationCreate` and returns the id every other `animation*` tool references. */
async function createAnimation(
  viewer: Viewer,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const result = await animationCreate(viewer, { positionSamples: SAMPLES, ...extra });
  return result.animationId as string;
}

describe("animationCreate", () => {
  test("adds a point entity with a sampled position and returns its animationId", async () => {
    const viewer = fakeViewer();

    const result = await animationCreate(viewer, { positionSamples: SAMPLES, name: "Plane" });

    expect(result.success).toBe(true);
    const animationId = result.animationId as string;
    expect(animationId).toMatch(/^animation-/);
    const entity = viewer.entities.getById(animationId);
    expect(entity?.name).toBe("Plane");
    expect(entity?.position).toBeDefined();
    expect(entity?.point).toBeDefined();
    expect(entity?.model).toBeUndefined();
  });

  test("builds a model (not point) entity when modelUri is given", async () => {
    const viewer = fakeViewer();

    const animationId = await createAnimation(viewer, {
      modelUri: "https://example.com/plane.glb",
    });

    const entity = viewer.entities.getById(animationId);
    expect(entity?.model).toBeDefined();
    expect(entity?.point).toBeUndefined();
  });

  test("applies loopMode/speedMultiplier/trackCamera onto the shared clock (autoPlay defaults to true)", async () => {
    const viewer = fakeViewer();

    const animationId = await createAnimation(viewer, {
      loopMode: "loop",
      speedMultiplier: 2,
      trackCamera: true,
    });

    expect(viewer.clock.clockRange).toBe(ClockRange.LOOP_STOP);
    expect(viewer.clock.multiplier).toBe(2);
    expect(viewer.clock.shouldAnimate).toBe(true);
    expect(viewer.trackedEntity?.id).toBe(animationId);
  });

  test("autoPlay: false leaves the clock paused", async () => {
    const viewer = fakeViewer();

    await createAnimation(viewer, { autoPlay: false });

    expect(viewer.clock.shouldAnimate).toBe(false);
  });

  test("defaults the path to leadTime 10 / trailTime 10 / width 2 with no material", async () => {
    const viewer = fakeViewer();

    const animationId = await createAnimation(viewer);
    const path = viewer.entities.getById(animationId)?.path;

    expect(path?.leadTime?.getValue(JulianDate.now())).toBe(10);
    expect(path?.trailTime?.getValue(JulianDate.now())).toBe(10);
    expect(path?.width?.getValue(JulianDate.now())).toBe(2);
    expect(path?.material).toBeUndefined();
  });

  test("applies pathLeadTime/pathTrailTime/pathWidth/pathColor onto the path at creation time", async () => {
    const viewer = fakeViewer();

    const animationId = await createAnimation(viewer, {
      pathLeadTime: 5,
      pathTrailTime: 20,
      pathWidth: 4,
      pathColor: { red: 1, green: 0, blue: 0, alpha: 0.5 },
    });
    const path = viewer.entities.getById(animationId)?.path;

    expect(path?.leadTime?.getValue(JulianDate.now())).toBe(5);
    expect(path?.trailTime?.getValue(JulianDate.now())).toBe(20);
    expect(path?.width?.getValue(JulianDate.now())).toBe(4);
    expect(path?.material?.getValue(JulianDate.now())?.color).toEqual(new Color(1, 0, 0, 0.5));
  });

  test("resolves { success: false, error } for malformed args (fewer than 2 position samples)", async () => {
    const viewer = fakeViewer();

    const result = await animationCreate(viewer, { positionSamples: [SAMPLES[0]] });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid animationCreate arguments");
    expect(viewer.entities.values).toHaveLength(0);
  });
});

describe("animationRemove", () => {
  test("removes the entity, unregisters it, and clears trackedEntity if it matches", async () => {
    const viewer = fakeViewer();
    const animationId = await createAnimation(viewer, { trackCamera: true });

    const result = await animationRemove(viewer, { animationId });

    expect(result).toEqual({ success: true });
    expect(viewer.entities.getById(animationId)).toBeUndefined();
    expect(viewer.trackedEntity).toBeUndefined();

    const again = await animationRemove(viewer, { animationId });
    expect(again.success).toBe(false);
    expect(again.error).toContain(`Unknown animationId "${animationId}"`);
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await animationRemove(viewer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid animationRemove arguments");
  });
});

describe("animationListActive", () => {
  test("lists every id animationCreate registered, and only those", async () => {
    const viewer = fakeViewer();
    const firstId = await createAnimation(viewer, { name: "First" });
    const secondId = await createAnimation(viewer, { name: "Second" });
    viewer.entities.add({ id: "unrelated" }); // not registered by animationCreate

    const result = await animationListActive(viewer, {});

    expect(result.success).toBe(true);
    expect(result.animations).toEqual(
      expect.arrayContaining([
        { animationId: firstId, name: "First" },
        { animationId: secondId, name: "Second" },
      ]),
    );
    expect((result.animations as unknown[]).length).toBe(2);
  });
});

describe("animationUpdatePath", () => {
  test("updates the entity's path graphics", async () => {
    const viewer = fakeViewer();
    const animationId = await createAnimation(viewer);

    const result = await animationUpdatePath(viewer, {
      animationId,
      leadTime: 5,
      trailTime: 6,
      width: 3,
      color: { red: 1, green: 0, blue: 0 },
    });

    expect(result).toEqual({ success: true });
    const entity = viewer.entities.getById(animationId) as Entity;
    expect(entity.path?.leadTime?.getValue()).toBe(5);
    expect(entity.path?.trailTime?.getValue()).toBe(6);
    expect(entity.path?.width?.getValue()).toBe(3);
  });

  test("resolves { success: false, error } for an unknown animationId", async () => {
    const viewer = fakeViewer();

    const result = await animationUpdatePath(viewer, { animationId: "nope", width: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown animationId "nope"');
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await animationUpdatePath(viewer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid animationUpdatePath arguments");
  });
});

describe("animationCameraTracking", () => {
  test("toggles viewer.trackedEntity for a known animation", async () => {
    const viewer = fakeViewer();
    const animationId = await createAnimation(viewer);

    expect(await animationCameraTracking(viewer, { animationId, track: true })).toEqual({
      success: true,
    });
    expect(viewer.trackedEntity?.id).toBe(animationId);

    expect(await animationCameraTracking(viewer, { animationId, track: false })).toEqual({
      success: true,
    });
    expect(viewer.trackedEntity).toBeUndefined();
  });

  test("resolves { success: false, error } for an unknown animationId", async () => {
    const viewer = fakeViewer();

    const result = await animationCameraTracking(viewer, { animationId: "nope", track: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown animationId "nope"');
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await animationCameraTracking(viewer, { animationId: "x" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid animationCameraTracking arguments");
  });
});

describe("clockControl", () => {
  test('action "configure" applies only the provided clock fields', async () => {
    const viewer = fakeViewer();

    const result = await clockControl(viewer, {
      action: "configure",
      clock: { multiplier: 5, clockRange: "LOOP_STOP", shouldAnimate: true },
    });

    expect(result).toEqual({ success: true });
    expect(viewer.clock.multiplier).toBe(5);
    expect(viewer.clock.clockRange).toBe(ClockRange.LOOP_STOP);
    expect(viewer.clock.shouldAnimate).toBe(true);
  });

  test('action "setTime" sets currentTime', async () => {
    const viewer = fakeViewer();

    const result = await clockControl(viewer, {
      action: "setTime",
      currentTime: "2024-06-01T00:00:00Z",
    });

    expect(result).toEqual({ success: true });
    expect(viewer.clock.currentTime).toBeDefined();
  });

  test('action "setMultiplier" sets the clock multiplier', async () => {
    const viewer = fakeViewer();

    const result = await clockControl(viewer, { action: "setMultiplier", multiplier: 10 });

    expect(result).toEqual({ success: true });
    expect(viewer.clock.multiplier).toBe(10);
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await clockControl(viewer, { action: "bogus" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid clockControl arguments");
  });
});

describe("globeSetLighting", () => {
  function fakeGlobeViewer() {
    const globe = {
      enableLighting: false,
      dynamicAtmosphereLighting: false,
      dynamicAtmosphereLightingFromSun: false,
    };
    return { viewer: { scene: { globe } } as unknown as Viewer, globe };
  }

  test("applies enableLighting and the optional atmosphere fields", async () => {
    const { viewer, globe } = fakeGlobeViewer();

    const result = await globeSetLighting(viewer, {
      enableLighting: true,
      enableDynamicAtmosphere: true,
      enableSunLighting: true,
    });

    expect(result).toEqual({ success: true });
    expect(globe.enableLighting).toBe(true);
    expect(globe.dynamicAtmosphereLighting).toBe(true);
    expect(globe.dynamicAtmosphereLightingFromSun).toBe(true);
  });

  test("leaves the optional atmosphere fields untouched when omitted", async () => {
    const { viewer, globe } = fakeGlobeViewer();

    await globeSetLighting(viewer, { enableLighting: true });

    expect(globe.enableLighting).toBe(true);
    expect(globe.dynamicAtmosphereLighting).toBe(false);
    expect(globe.dynamicAtmosphereLightingFromSun).toBe(false);
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const { viewer } = fakeGlobeViewer();

    const result = await globeSetLighting(viewer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid globeSetLighting arguments");
  });
});
