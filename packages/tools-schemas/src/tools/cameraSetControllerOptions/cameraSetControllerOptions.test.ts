import { describe, expect, test } from "vitest";
import {
  buildCameraSetControllerOptionsInputSchema,
  DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS,
  defaultCameraSetControllerOptionsInputSchema,
} from "./cameraSetControllerOptions.js";

describe("buildCameraSetControllerOptionsInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildCameraSetControllerOptionsInputSchema();

    expect(schema.shape.enableRotate.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableRotate,
    );
    expect(schema.shape.enableTranslate.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableTranslate,
    );
    expect(schema.shape.enableZoom.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableZoom,
    );
    expect(schema.shape.enableTilt.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableTilt,
    );
    expect(schema.shape.enableLook.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableLook,
    );
    expect(schema.shape.maximumZoomDistance.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.maximumZoomDistance,
    );
    expect(schema.shape.minimumZoomDistance.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.minimumZoomDistance,
    );
    expect(schema.shape.enableCollisionDetection.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableCollisionDetection,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildCameraSetControllerOptionsInputSchema({
      maximumZoomDistance: "custom max zoom hint",
    });

    expect(schema.shape.maximumZoomDistance.description).toBe("custom max zoom hint");
    expect(schema.shape.enableZoom.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableZoom,
    );
    expect(schema.shape.minimumZoomDistance.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.minimumZoomDistance,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildCameraSetControllerOptionsInputSchema({
      maximumZoomDistance: "custom max zoom hint",
    });

    expect(schema.safeParse({ enableZoom: false, maximumZoomDistance: 20000 }).success).toBe(true);
    expect(schema.safeParse({ maximumZoomDistance: -5 }).success).toBe(false);
  });
});

describe("defaultCameraSetControllerOptionsInputSchema", () => {
  test("is equivalent to buildCameraSetControllerOptionsInputSchema() with no overrides", () => {
    expect(defaultCameraSetControllerOptionsInputSchema.shape.enableRotate.description).toBe(
      DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS.enableRotate,
    );
  });
});
