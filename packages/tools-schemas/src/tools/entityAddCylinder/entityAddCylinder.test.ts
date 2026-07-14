import { describe, expect, test } from "vitest";
import {
  buildEntityAddCylinderInputSchema,
  DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS,
  defaultEntityAddCylinderInputSchema,
} from "./entityAddCylinder.js";

describe("buildEntityAddCylinderInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddCylinderInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.cylinder.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.cylinder,
    );
    expect(schema.shape.orientation.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.orientation,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddCylinderInputSchema({ cylinder: "custom cylinder hint" });

    expect(schema.shape.cylinder.description).toBe("custom cylinder hint");
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.orientation.description).toBe(
      DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS.orientation,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddCylinderInputSchema({ cylinder: "custom cylinder hint" });

    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        cylinder: { length: 10, topRadius: 0, bottomRadius: 2 },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        cylinder: { length: 0, topRadius: 1, bottomRadius: 2 },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddCylinderInputSchema", () => {
  test("is equivalent to buildEntityAddCylinderInputSchema() with no overrides", () => {
    const schema = buildEntityAddCylinderInputSchema();

    expect(defaultEntityAddCylinderInputSchema.shape.position.description).toBe(
      schema.shape.position.description,
    );
    expect(defaultEntityAddCylinderInputSchema.shape.cylinder.description).toBe(
      schema.shape.cylinder.description,
    );
  });
});
