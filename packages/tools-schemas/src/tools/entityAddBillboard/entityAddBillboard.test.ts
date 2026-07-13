import { describe, expect, test } from "vitest";
import {
  buildEntityAddBillboardInputSchema,
  DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS,
  defaultEntityAddBillboardInputSchema,
} from "./entityAddBillboard.js";

describe("buildEntityAddBillboardInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddBillboardInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.image.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.image,
    );
    expect(schema.shape.pixelOffset.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.pixelOffset,
    );
    expect(schema.shape.width.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.width,
    );
    expect(schema.shape.height.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.height,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddBillboardInputSchema({ image: "custom image hint" });

    expect(schema.shape.image.description).toBe("custom image hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS.position,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddBillboardInputSchema({ image: "custom image hint" });

    expect(
      schema.safeParse({
        id: "b1",
        position: { longitude: 0, latitude: 0 },
        image: "https://example.com/a.png",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "b1",
        position: { longitude: 0, latitude: 0 },
        image: "https://example.com/a.png",
        width: 0,
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddBillboardInputSchema", () => {
  test("is equivalent to buildEntityAddBillboardInputSchema() with no overrides", () => {
    const schema = buildEntityAddBillboardInputSchema();

    expect(defaultEntityAddBillboardInputSchema.shape.id.description).toBe(
      schema.shape.id.description,
    );
    expect(defaultEntityAddBillboardInputSchema.shape.image.description).toBe(
      schema.shape.image.description,
    );
  });
});
