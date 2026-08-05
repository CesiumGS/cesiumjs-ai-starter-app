import { describe, expect, test } from "vitest";
import {
  buildAnimationCreateInputSchema,
  DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS,
  defaultAnimationCreateInputSchema,
} from "./animationCreate.js";

describe("buildAnimationCreateInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildAnimationCreateInputSchema();

    expect(schema.shape.positionSamples.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.positionSamples,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.startTime.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.startTime,
    );
    expect(schema.shape.stopTime.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.stopTime,
    );
    expect(schema.shape.interpolationAlgorithm.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.interpolationAlgorithm,
    );
    expect(schema.shape.showPath.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.showPath,
    );
    expect(schema.shape.pathLeadTime.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.pathLeadTime,
    );
    expect(schema.shape.pathTrailTime.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.pathTrailTime,
    );
    expect(schema.shape.pathWidth.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.pathWidth,
    );
    expect(schema.shape.pathColor.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.pathColor,
    );
    expect(schema.shape.modelPreset.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.modelPreset,
    );
    expect(schema.shape.modelUri.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.modelUri,
    );
    expect(schema.shape.modelScale.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.modelScale,
    );
    expect(schema.shape.loopMode.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.loopMode,
    );
    expect(schema.shape.clampToGround.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.clampToGround,
    );
    expect(schema.shape.speedMultiplier.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.speedMultiplier,
    );
    expect(schema.shape.autoPlay.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.autoPlay,
    );
    expect(schema.shape.trackCamera.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.trackCamera,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildAnimationCreateInputSchema({ modelUri: "custom model URI hint" });

    expect(schema.shape.modelUri.description).toBe("custom model URI hint");
    expect(schema.shape.positionSamples.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.positionSamples,
    );
    expect(schema.shape.modelPreset.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.modelPreset,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildAnimationCreateInputSchema({ modelUri: "custom model URI hint" });

    expect(
      schema.safeParse({
        positionSamples: [
          { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
          { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
        ],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        positionSamples: [{ time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("defaultAnimationCreateInputSchema", () => {
  test("is equivalent to buildAnimationCreateInputSchema() with no overrides", () => {
    expect(defaultAnimationCreateInputSchema.shape.positionSamples.description).toBe(
      DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS.positionSamples,
    );
  });
});
