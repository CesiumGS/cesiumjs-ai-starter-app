import { describe, expect, test } from "vitest";
import {
  buildEntityAddEllipseInputSchema,
  DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS,
  defaultEntityAddEllipseInputSchema,
} from "./entityAddEllipse.js";

describe("buildEntityAddEllipseInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddEllipseInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.ellipse.description).toBe(
      DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.ellipse,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddEllipseInputSchema({ ellipse: "custom ellipse hint" });

    expect(schema.shape.ellipse.description).toBe("custom ellipse hint");
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS.name);
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddEllipseInputSchema({ ellipse: "custom ellipse hint" });

    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        ellipse: { semiMajorAxis: 10, semiMinorAxis: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddEllipseInputSchema", () => {
  test("is equivalent to buildEntityAddEllipseInputSchema() with no overrides", () => {
    const schema = buildEntityAddEllipseInputSchema();

    expect(defaultEntityAddEllipseInputSchema.shape.position.description).toBe(
      schema.shape.position.description,
    );
    expect(defaultEntityAddEllipseInputSchema.shape.ellipse.description).toBe(
      schema.shape.ellipse.description,
    );
  });
});
