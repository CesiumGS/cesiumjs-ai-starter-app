import { describe, expect, test } from "vitest";
import {
  buildImageryRemoveInputSchema,
  DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS,
  defaultImageryRemoveInputSchema,
} from "./imageryRemove.js";

describe("buildImageryRemoveInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildImageryRemoveInputSchema();

    expect(schema.shape.index.description).toBe(DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.index);
    expect(schema.shape.name.description).toBe(DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.removeAll.description).toBe(
      DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.removeAll,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildImageryRemoveInputSchema({ removeAll: "custom remove-all hint" });

    expect(schema.shape.removeAll.description).toBe("custom remove-all hint");
    expect(schema.shape.index.description).toBe(DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.index);
    expect(schema.shape.name.description).toBe(DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.name);
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildImageryRemoveInputSchema({ removeAll: "custom remove-all hint" });

    expect(schema.safeParse({ removeAll: true }).success).toBe(true);
    expect(schema.safeParse({ index: -1 }).success).toBe(false);
  });
});

describe("defaultImageryRemoveInputSchema", () => {
  test("is equivalent to buildImageryRemoveInputSchema() with no overrides", () => {
    expect(defaultImageryRemoveInputSchema.shape.index.description).toBe(
      DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS.index,
    );
  });
});
