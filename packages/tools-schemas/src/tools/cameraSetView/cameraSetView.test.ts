import { describe, expect, test } from "vitest";
import {
  buildCameraSetViewInputSchema,
  DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS,
  defaultCameraSetViewInputSchema,
} from "./cameraSetView.js";

describe("buildCameraSetViewInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildCameraSetViewInputSchema();

    expect(schema.shape.destination.description).toBe(
      DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS.destination,
    );
    expect(schema.shape.orientation.description).toBe(
      DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS.orientation,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildCameraSetViewInputSchema({ orientation: "custom orientation hint" });

    expect(schema.shape.orientation.description).toBe("custom orientation hint");
    expect(schema.shape.destination.description).toBe(
      DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS.destination,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildCameraSetViewInputSchema({ orientation: "custom orientation hint" });

    expect(
      schema.safeParse({ destination: { longitude: 0, latitude: 0, height: 1000 } }).success,
    ).toBe(true);
    expect(schema.safeParse({ destination: { longitude: 200, latitude: 0 } }).success).toBe(false);
  });
});

describe("defaultCameraSetViewInputSchema", () => {
  test("is equivalent to buildCameraSetViewInputSchema() with no overrides", () => {
    expect(defaultCameraSetViewInputSchema.shape.destination.description).toBe(
      DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS.destination,
    );
  });
});
