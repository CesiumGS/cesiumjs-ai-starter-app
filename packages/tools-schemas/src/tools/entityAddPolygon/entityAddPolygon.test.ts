import { describe, expect, test } from "vitest";
import {
  buildEntityAddPolygonInputSchema,
  DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS,
  defaultEntityAddPolygonInputSchema,
} from "./entityAddPolygon.js";

describe("buildEntityAddPolygonInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddPolygonInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.positions.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.positions,
    );
    expect(schema.shape.material.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.material,
    );
    expect(schema.shape.outlineColor.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.outlineColor,
    );
    expect(schema.shape.outlineWidth.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.outlineWidth,
    );
    expect(schema.shape.height.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.height,
    );
    expect(schema.shape.extrudedHeight.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.extrudedHeight,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddPolygonInputSchema({ positions: "custom positions hint" });

    expect(schema.shape.positions.description).toBe("custom positions hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.material.description).toBe(
      DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS.material,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddPolygonInputSchema({ positions: "custom positions hint" });

    expect(
      schema.safeParse({
        id: "poly1",
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "poly1",
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddPolygonInputSchema", () => {
  test("is equivalent to buildEntityAddPolygonInputSchema() with no overrides", () => {
    expect(defaultEntityAddPolygonInputSchema.shape.id.description).toBe(
      buildEntityAddPolygonInputSchema().shape.id.description,
    );
  });
});
