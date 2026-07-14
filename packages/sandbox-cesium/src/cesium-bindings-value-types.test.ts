import { describe, expect, test, vi } from "vitest";
import { runCesiumCodeInSandbox } from "./cesium-code-sandbox.js";

/**
 * Regression coverage for the transparent value-type binding design (see
 * `buildCesiumValueTypeGuestPrelude` in `cesium-bindings.ts`): generated code referencing common
 * CesiumJS value types/enums that were never explicitly bound as host-call leaves — named `Color`
 * constants, `VerticalOrigin`, `new Cesium.Cartesian2(...)`, `Cesium.Cartesian3.fromDegreesArray`,
 * `Color#withAlpha` — must resolve entirely in-sandbox (no "unbound symbol" crash) and still
 * arrive at the real `Viewer` as real CesiumJS instances once revived at the host boundary.
 */

function fakeViewer() {
  const entitiesById = new Map<string, unknown>();
  let nextId = 0;

  return {
    camera: {
      flyTo: vi.fn(() => {}),
      setView: vi.fn(),
      positionCartographic: { latitude: 0, longitude: 0, height: 0 },
    },
    entities: {
      get values() {
        return Array.from(entitiesById.values());
      },
      add: vi.fn((opts: Record<string, unknown>) => {
        const id = `entity-${nextId++}`;
        const entity = { id, ...opts };
        entitiesById.set(id, entity);
        return entity;
      }),
      remove: vi.fn((entity: { id: string }) => entitiesById.delete(entity.id)),
      removeAll: vi.fn(() => entitiesById.clear()),
    },
  };
}

describe("repro: user-reported snippet with VerticalOrigin/Color constants/polygon", () => {
  test("runs the exact reported snippet without crashing", async () => {
    const viewer = fakeViewer();

    const code = `
viewer.entities.add({
  name: "New York City",
  position: Cesium.Cartesian3.fromDegrees(-74.006, 40.7128, 0.0),
  point: {
    pixelSize: 10,
    color: Cesium.Color.YELLOW,
  },
  label: {
    text: "New York City",
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -12),
  },
});

viewer.entities.add({
  name: "London",
  position: Cesium.Cartesian3.fromDegrees(-0.1276, 51.5074, 0.0),
  point: {
    pixelSize: 10,
    color: Cesium.Color.YELLOW,
  },
  label: {
    text: "London",
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -12),
  },
});

viewer.entities.add({
  name: "Manhattan Polygon",
  polygon: {
    hierarchy: Cesium.Cartesian3.fromDegreesArray([
      -74.0270, 40.7003,
      -73.9960, 40.7003,
      -73.9960, 40.8780,
      -74.0270, 40.8780,
    ]),
    material: Cesium.Color.RED.withAlpha(0.35),
    outline: true,
    outlineColor: Cesium.Color.RED,
  },
});

viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-50.0, 40.0, 12000000.0),
  orientation: {
    heading: Cesium.Math.toRadians(0.0),
    pitch: Cesium.Math.toRadians(-70.0),
    roll: 0.0,
  },
});
`;

    const outcome = await runCesiumCodeInSandbox({ viewer: viewer as never, code });

    expect(outcome.success).toBe(true);
    expect(viewer.entities.add).toHaveBeenCalledTimes(3);
    expect(viewer.camera.setView).toHaveBeenCalledTimes(1);

    const calls = viewer.entities.add.mock.calls;
    const nyc = calls[0][0] as any;
    expect(nyc.point.color.red).toBeCloseTo(1, 5);
    expect(nyc.point.color.green).toBeCloseTo(1, 5);
    expect(nyc.point.color.blue).toBeCloseTo(0, 5);
    expect(nyc.label.verticalOrigin).toBe(1);
    expect(nyc.label.pixelOffset.x).toBe(0);
    expect(nyc.label.pixelOffset.y).toBe(-12);

    const polygon = calls[2][0] as any;
    expect(Array.isArray(polygon.polygon.hierarchy)).toBe(true);
    expect(polygon.polygon.hierarchy.length).toBe(4);
    expect(polygon.polygon.material.red).toBeCloseTo(1, 5);
    expect(polygon.polygon.material.alpha).toBeCloseTo(0.35, 5);
  });
});