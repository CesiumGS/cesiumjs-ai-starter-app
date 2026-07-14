import { describe, expect, test } from "vitest";
import {
  buildEntityAddBoxInputSchema,
  DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS,
  defaultEntityAddBoxInputSchema,
} from "./entityAddBox.js";

describe("buildEntityAddBoxInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddBoxInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.box.description).toBe(DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.box);
    expect(schema.shape.orientation.description).toBe(
      DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.orientation,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddBoxInputSchema({ box: "custom box hint" });

    expect(schema.shape.box.description).toBe("custom box hint");
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.orientation.description).toBe(
      DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS.orientation,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddBoxInputSchema({ box: "custom box hint" });

    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        box: { dimensions: { x: 1, y: 1, z: 1 } },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        position: { longitude: 0, latitude: 0 },
        box: { dimensions: { x: 1, y: 0, z: 1 } },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddBoxInputSchema", () => {
  test("is equivalent to buildEntityAddBoxInputSchema() with no overrides", () => {
    const schema = buildEntityAddBoxInputSchema();

    expect(defaultEntityAddBoxInputSchema.shape.position.description).toBe(
      schema.shape.position.description,
    );
    expect(defaultEntityAddBoxInputSchema.shape.box.description).toBe(schema.shape.box.description);
  });
});
