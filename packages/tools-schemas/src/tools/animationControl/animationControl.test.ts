import { describe, expect, test } from "vitest";
import {
  buildAnimationControlInputSchema,
  DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS,
  defaultAnimationControlInputSchema,
} from "./animationControl.js";

describe("buildAnimationControlInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildAnimationControlInputSchema();

    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS.animationId,
    );
    expect(schema.shape.action.description).toBe(
      DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS.action,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildAnimationControlInputSchema({ action: "custom action hint" });

    expect(schema.shape.action.description).toBe("custom action hint");
    expect(schema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS.animationId,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildAnimationControlInputSchema({ action: "custom action hint" });

    expect(schema.safeParse({ animationId: "a1", action: "play" }).success).toBe(true);
    expect(schema.safeParse({ animationId: "a1", action: "stop" }).success).toBe(false);
  });
});

describe("defaultAnimationControlInputSchema", () => {
  test("is equivalent to buildAnimationControlInputSchema() with no overrides", () => {
    expect(defaultAnimationControlInputSchema.shape.animationId.description).toBe(
      DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS.animationId,
    );
  });
});
