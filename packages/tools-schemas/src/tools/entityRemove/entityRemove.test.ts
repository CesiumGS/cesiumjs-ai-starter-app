import { describe, expect, test } from "vitest";
import {
  buildEntityRemoveInputSchema,
  DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS,
  defaultEntityRemoveInputSchema,
} from "./entityRemove.js";

describe("buildEntityRemoveInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityRemoveInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS.id);
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityRemoveInputSchema({ id: "custom id hint" });

    expect(schema.shape.id.description).toBe("custom id hint");
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityRemoveInputSchema({ id: "custom id hint" });

    expect(schema.safeParse({ id: "p1" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("defaultEntityRemoveInputSchema", () => {
  test("is equivalent to buildEntityRemoveInputSchema() with no overrides", () => {
    expect(defaultEntityRemoveInputSchema.shape.id.description).toBe(
      DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS.id,
    );
  });
});
