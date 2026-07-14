import { describe, expect, test } from "vitest";
import {
  buildEntityAddPointInputSchema,
  DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS,
  defaultEntityAddPointInputSchema,
} from "./entityAddPoint.js";

describe("buildEntityAddPointInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddPointInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.color.description).toBe(DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.color);
    expect(schema.shape.pixelSize.description).toBe(
      DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.pixelSize,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddPointInputSchema({ color: "custom color hint" });

    expect(schema.shape.color.description).toBe("custom color hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS.position,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddPointInputSchema({ color: "custom color hint" });

    expect(schema.safeParse({ id: "p1", position: { longitude: 0, latitude: 0 } }).success).toBe(
      true,
    );
    expect(schema.safeParse({ id: "p1", position: { longitude: 0, latitude: 91 } }).success).toBe(
      false,
    );
  });
});

describe("defaultEntityAddPointInputSchema", () => {
  test("is equivalent to buildEntityAddPointInputSchema() with no overrides", () => {
    expect(defaultEntityAddPointInputSchema.shape.id.description).toBe(
      buildEntityAddPointInputSchema().shape.id.description,
    );
  });
});
