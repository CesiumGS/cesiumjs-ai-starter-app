import { describe, expect, test } from "vitest";
import {
  buildAnimationUpdatePathInputSchema,
  DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS,
  defaultAnimationUpdatePathInputSchema,
} from "./animationUpdatePath.js";

describe("buildAnimationUpdatePathInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildAnimationUpdatePathInputSchema();

    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.animationId,
    );
    expect(schema.shape.leadTime.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.leadTime,
    );
    expect(schema.shape.trailTime.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.trailTime,
    );
    expect(schema.shape.width.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.width,
    );
    expect(schema.shape.color.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.color,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildAnimationUpdatePathInputSchema({ color: "custom color hint" });

    expect(schema.shape.color.description).toBe("custom color hint");
    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.animationId,
    );
    expect(schema.shape.leadTime.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.leadTime,
    );
    expect(schema.shape.trailTime.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.trailTime,
    );
    expect(schema.shape.width.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.width,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildAnimationUpdatePathInputSchema({ color: "custom color hint" });

    expect(schema.safeParse({ animationId: "a1", width: 4 }).success).toBe(true);
    expect(
      schema.safeParse({
        animationId: "a1",
        color: { red: 2, green: 0, blue: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("defaultAnimationUpdatePathInputSchema", () => {
  test("is equivalent to buildAnimationUpdatePathInputSchema() with no overrides", () => {
    expect(defaultAnimationUpdatePathInputSchema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS.animationId,
    );
  });
});
