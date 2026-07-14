import { describe, expect, test } from "vitest";
import {
  buildCameraStartOrbitInputSchema,
  DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS,
  defaultCameraStartOrbitInputSchema,
} from "./cameraStartOrbit.js";

describe("buildCameraStartOrbitInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildCameraStartOrbitInputSchema();

    expect(schema.shape.speed.description).toBe(
      DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS.speed,
    );
    expect(schema.shape.direction.description).toBe(
      DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS.direction,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildCameraStartOrbitInputSchema({ direction: "custom direction hint" });

    expect(schema.shape.direction.description).toBe("custom direction hint");
    expect(schema.shape.speed.description).toBe(
      DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS.speed,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildCameraStartOrbitInputSchema({ direction: "custom direction hint" });

    expect(schema.safeParse({ speed: 2, direction: "clockwise" }).success).toBe(true);
    expect(schema.safeParse({ speed: 100 }).success).toBe(false);
  });
});

describe("defaultCameraStartOrbitInputSchema", () => {
  test("is equivalent to buildCameraStartOrbitInputSchema() with no overrides", () => {
    expect(defaultCameraStartOrbitInputSchema.shape.speed.description).toBe(
      DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS.speed,
    );
  });
});
