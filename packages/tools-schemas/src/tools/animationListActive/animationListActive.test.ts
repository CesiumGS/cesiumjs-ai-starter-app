import { describe, expect, test } from "vitest";
import {
  buildAnimationListActiveInputSchema,
  defaultAnimationListActiveInputSchema,
} from "./animationListActive.js";

describe("buildAnimationListActiveInputSchema", () => {
  test("returns a schema that accepts an empty object", () => {
    const schema = buildAnimationListActiveInputSchema();

    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("defaultAnimationListActiveInputSchema", () => {
  test("is defined", () => {
    expect(defaultAnimationListActiveInputSchema).toBeDefined();
    expect(defaultAnimationListActiveInputSchema.safeParse({}).success).toBe(true);
  });
});
