import { describe, expect, test } from "vitest";
import {
  buildAnimationCameraTrackingInputSchema,
  DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS,
  defaultAnimationCameraTrackingInputSchema,
} from "./animationCameraTracking.js";

describe("buildAnimationCameraTrackingInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildAnimationCameraTrackingInputSchema();

    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.animationId,
    );
    expect(schema.shape.track.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.track,
    );
    expect(schema.shape.range.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.range,
    );
    expect(schema.shape.pitch.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.pitch,
    );
    expect(schema.shape.heading.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.heading,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildAnimationCameraTrackingInputSchema({
      range: "custom range hint",
    });

    expect(schema.shape.range.description).toBe("custom range hint");
    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.animationId,
    );
    expect(schema.shape.track.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.track,
    );
    expect(schema.shape.pitch.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.pitch,
    );
    expect(schema.shape.heading.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.heading,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildAnimationCameraTrackingInputSchema({
      range: "custom range hint",
    });

    expect(schema.safeParse({ animationId: "a1", track: true, range: 1000 }).success).toBe(true);
    expect(schema.safeParse({ animationId: "a1", track: true, range: 0 }).success).toBe(false);
  });
});

describe("defaultAnimationCameraTrackingInputSchema", () => {
  test("is equivalent to buildAnimationCameraTrackingInputSchema() with no overrides", () => {
    expect(defaultAnimationCameraTrackingInputSchema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS.animationId,
    );
  });
});
