import { describe, expect, test } from "vitest";
import {
  buildAnimationRemoveInputSchema,
  DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS,
  defaultAnimationRemoveInputSchema,
} from "./animationRemove.js";

describe("buildAnimationRemoveInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildAnimationRemoveInputSchema();

    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS.animationId,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildAnimationRemoveInputSchema({ animationId: "custom animation ID hint" });

    expect(schema.shape.animationId.description).toBe("custom animation ID hint");
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildAnimationRemoveInputSchema({ animationId: "custom animation ID hint" });

    expect(schema.safeParse({ animationId: "a1" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("defaultAnimationRemoveInputSchema", () => {
  test("is equivalent to buildAnimationRemoveInputSchema() with no overrides", () => {
    expect(defaultAnimationRemoveInputSchema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS.animationId,
    );
  });
});
