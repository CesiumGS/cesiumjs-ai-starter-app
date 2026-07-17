import { describe, expect, test, vi } from "vitest";
import {
  ClassificationType,
  Color,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  ShadowMode,
} from "cesium";
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

/**
 * Coverage for the remaining value types/enums declared by `guestValueTypeBody`
 * (`guest-prelude-value-types.ts`) that no other test in this package exercises through an actual
 * sandbox run: `HorizontalOrigin`/`HeightReference`/`LabelStyle`/`ClassificationType`/`ShadowMode`
 * enums, `HeadingPitchRoll`/`NearFarScalar` value types, and the bare top-level aliases
 * (destructured off `Cesium` with no prefix, e.g. `const { Cartesian3 } = Cesium;`) including the
 * conventional `CesiumMath` rename. `VerticalOrigin`, `Cartesian2`, `Color`, `Cartesian3`, and
 * `Cesium.Math` (prefixed form) are already covered by the repro test above and
 * `cesium-code-sandbox.codegen-cases.test.ts`; `HeadingPitchRange` is covered by
 * `cesium-code-sandbox.test.ts`.
 */
describe("value-type/enum coverage not exercised elsewhere in this package", () => {
  test("HorizontalOrigin/HeightReference/LabelStyle/ClassificationType/ShadowMode enum constants match the real CesiumJS values", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        return {
          horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          labelStyle: Cesium.LabelStyle.FILL_AND_OUTLINE,
          classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
          shadowMode: Cesium.ShadowMode.CAST_ONLY,
        };
      `,
    });

    expect(outcome).toEqual({
      success: true,
      result: {
        horizontalOrigin: HorizontalOrigin.RIGHT,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        labelStyle: LabelStyle.FILL_AND_OUTLINE,
        classificationType: ClassificationType.CESIUM_3D_TILE,
        shadowMode: ShadowMode.CAST_ONLY,
      },
    });
  });

  test("constructs real HeadingPitchRoll and NearFarScalar instances that survive the round trip to the host", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const entity = await viewer.entities.add({
          orientation: new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(45), 0, 0),
          billboard: {
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 100000, 0.1),
          },
        });
        return {
          heading: entity.orientation.heading,
          near: entity.billboard.scaleByDistance.near,
          farValue: entity.billboard.scaleByDistance.farValue,
        };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { heading: number; near: number; farValue: number };
    expect(result.heading).toBeCloseTo(Math.PI / 4, 5);
    expect(result.near).toBe(1000);
    expect(result.farValue).toBe(0.1);
  });

  test("bare top-level aliases (destructured off Cesium with no prefix) resolve for value types, enums, and the CesiumMath rename", async () => {
    const viewer = fakeViewer();

    const outcome = await runCesiumCodeInSandbox({
      viewer: viewer as never,
      code: `
        const { Cartesian3, Color, LabelStyle } = Cesium;
        const position = Cartesian3.fromDegrees(-1.5, 51.2, 0);
        const entity = await viewer.entities.add({
          position,
          point: { color: Color.CYAN },
          label: { text: "bare-alias", style: LabelStyle.OUTLINE },
        });
        return {
          color: [entity.point.color.red, entity.point.color.green, entity.point.color.blue],
          labelStyle: entity.label.style,
          degrees: CesiumMath.toDegrees(Math.PI),
        };
      `,
    });

    expect(outcome.success).toBe(true);
    const result = outcome.result as { color: number[]; labelStyle: number; degrees: number };
    expect(result.color[0]).toBeCloseTo(Color.CYAN.red, 5);
    expect(result.color[1]).toBeCloseTo(Color.CYAN.green, 5);
    expect(result.color[2]).toBeCloseTo(Color.CYAN.blue, 5);
    expect(result.labelStyle).toBe(LabelStyle.OUTLINE);
    expect(result.degrees).toBeCloseTo(180, 5);
  });
});
