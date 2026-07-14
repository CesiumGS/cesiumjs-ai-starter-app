import { describe, expect, test } from "vitest";
import {
  buildEntityAddRectangleInputSchema,
  DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS,
  defaultEntityAddRectangleInputSchema,
} from "./entityAddRectangle.js";

describe("buildEntityAddRectangleInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddRectangleInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.rectangle.description).toBe(
      DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.rectangle,
    );
    expect(schema.shape.name.description).toBe(
      DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.name,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddRectangleInputSchema({ rectangle: "custom rectangle hint" });

    expect(schema.shape.rectangle.description).toBe("custom rectangle hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.name.description).toBe(
      DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS.name,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddRectangleInputSchema({ rectangle: "custom rectangle hint" });

    expect(
      schema.safeParse({
        rectangle: { coordinates: { north: 1, south: 0, east: 1, west: 0 } },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        rectangle: { coordinates: { north: 91, south: 0, east: 1, west: 0 } },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddRectangleInputSchema", () => {
  test("is equivalent to buildEntityAddRectangleInputSchema() with no overrides", () => {
    expect(defaultEntityAddRectangleInputSchema.shape.rectangle.description).toBe(
      buildEntityAddRectangleInputSchema().shape.rectangle.description,
    );
  });
});
