import { describe, expect, test } from "vitest";
import {
  buildCameraOrbitInputSchema,
  DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS,
  defaultCameraOrbitInputSchema,
} from "./cameraOrbit.js";

describe("buildCameraOrbitInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildCameraOrbitInputSchema();
    const [startOption, stopOption] = schema.options;

    expect(startOption?.shape.action.description).toBe(
      DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.action,
    );
    expect(startOption?.shape.speed.description).toBe(
      DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.speed,
    );
    expect(startOption?.shape.direction.description).toBe(
      DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.direction,
    );
    expect(stopOption?.shape.action.description).toBe(
      DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.action,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildCameraOrbitInputSchema({ direction: "custom direction hint" });
    const [startOption] = schema.options;

    expect(startOption?.shape.direction.description).toBe("custom direction hint");
    expect(startOption?.shape.speed.description).toBe(
      DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.speed,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildCameraOrbitInputSchema();

    expect(schema.safeParse({ action: "start", speed: 2, direction: "clockwise" }).success).toBe(
      true,
    );
    expect(schema.safeParse({ action: "start", speed: 100 }).success).toBe(false);
    expect(schema.safeParse({ action: "stop" }).success).toBe(true);
    expect(schema.safeParse({ action: "unknown" }).success).toBe(false);
  });
});

describe("defaultCameraOrbitInputSchema", () => {
  test("is equivalent to buildCameraOrbitInputSchema() with no overrides", () => {
    const [builtStart] = buildCameraOrbitInputSchema().options;
    const [defaultStart] = defaultCameraOrbitInputSchema.options;

    expect(defaultStart.shape.speed.description).toBe(builtStart.shape.speed.description);
  });
});
