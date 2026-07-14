import { describe, expect, test } from "vitest";
import {
  buildEntityAddCorridorInputSchema,
  DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS,
  defaultEntityAddCorridorInputSchema,
} from "./entityAddCorridor.js";

describe("buildEntityAddCorridorInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddCorridorInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.corridor.description).toBe(
      DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.corridor,
    );
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddCorridorInputSchema({ corridor: "custom corridor hint" });

    expect(schema.shape.corridor.description).toBe("custom corridor hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS.name);
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddCorridorInputSchema({ corridor: "custom corridor hint" });

    expect(
      schema.safeParse({
        corridor: {
          positions: [
            { longitude: 0, latitude: 0 },
            { longitude: 1, latitude: 1 },
          ],
          width: 10,
        },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        corridor: {
          positions: [{ longitude: 0, latitude: 0 }],
          width: 10,
        },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddCorridorInputSchema", () => {
  test("is equivalent to buildEntityAddCorridorInputSchema() with no overrides", () => {
    const schema = buildEntityAddCorridorInputSchema();

    expect(defaultEntityAddCorridorInputSchema.shape.id.description).toBe(
      schema.shape.id.description,
    );
    expect(defaultEntityAddCorridorInputSchema.shape.corridor.description).toBe(
      schema.shape.corridor.description,
    );
  });
});
