import { describe, expect, test } from "vitest";
import {
  buildEntityAddWallInputSchema,
  DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS,
  defaultEntityAddWallInputSchema,
} from "./entityAddWall.js";

describe("buildEntityAddWallInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddWallInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.wall.description).toBe(DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.wall);
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddWallInputSchema({ wall: "custom wall hint" });

    expect(schema.shape.wall.description).toBe("custom wall hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.name.description).toBe(DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS.name);
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddWallInputSchema({ wall: "custom wall hint" });

    expect(
      schema.safeParse({
        wall: {
          positions: [
            { longitude: 0, latitude: 0 },
            { longitude: 1, latitude: 1 },
          ],
          maximumHeights: [10, 20],
        },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        wall: {
          positions: [{ longitude: 0, latitude: 0 }],
          maximumHeights: [10],
        },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddWallInputSchema", () => {
  test("is equivalent to buildEntityAddWallInputSchema() with no overrides", () => {
    expect(defaultEntityAddWallInputSchema.shape.wall.description).toBe(
      buildEntityAddWallInputSchema().shape.wall.description,
    );
  });
});
