import { describe, expect, test } from "vitest";
import {
  buildEntityAddPolylineInputSchema,
  DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS,
  defaultEntityAddPolylineInputSchema,
} from "./entityAddPolyline.js";

describe("buildEntityAddPolylineInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddPolylineInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.positions.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.positions,
    );
    expect(schema.shape.width.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.width,
    );
    expect(schema.shape.material.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.material,
    );
    expect(schema.shape.clampToGround.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.clampToGround,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddPolylineInputSchema({ width: "custom width hint" });

    expect(schema.shape.width.description).toBe("custom width hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.positions.description).toBe(
      DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS.positions,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddPolylineInputSchema({ width: "custom width hint" });

    expect(
      schema.safeParse({
        id: "line1",
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "line1",
        positions: [{ longitude: 0, latitude: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddPolylineInputSchema", () => {
  test("is equivalent to buildEntityAddPolylineInputSchema() with no overrides", () => {
    expect(defaultEntityAddPolylineInputSchema.shape.id.description).toBe(
      buildEntityAddPolylineInputSchema().shape.id.description,
    );
  });
});
