import { describe, expect, test } from "vitest";
import {
  buildCameraLookAtTransformInputSchema,
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS,
  defaultCameraLookAtTransformInputSchema,
} from "./cameraLookAtTransform.js";

describe("buildCameraLookAtTransformInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildCameraLookAtTransformInputSchema();

    expect(schema.shape.target.description).toBe(
      DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS.target,
    );
    expect(schema.shape.offset.description).toBe(
      DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS.offset,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildCameraLookAtTransformInputSchema({ offset: "custom offset hint" });

    expect(schema.shape.offset.description).toBe("custom offset hint");
    expect(schema.shape.target.description).toBe(
      DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS.target,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildCameraLookAtTransformInputSchema({ offset: "custom offset hint" });

    expect(schema.safeParse({ target: { longitude: 0, latitude: 0 } }).success).toBe(true);
    expect(
      schema.safeParse({ target: { longitude: 0, latitude: 0 }, offset: { range: 0 } }).success,
    ).toBe(false);
  });
});

describe("defaultCameraLookAtTransformInputSchema", () => {
  test("is equivalent to buildCameraLookAtTransformInputSchema() with no overrides", () => {
    expect(defaultCameraLookAtTransformInputSchema.shape.target.description).toBe(
      DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS.target,
    );
  });
});
