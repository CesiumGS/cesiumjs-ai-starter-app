import { describe, expect, test } from "vitest";
import {
  buildEntityAddModelInputSchema,
  DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS,
  defaultEntityAddModelInputSchema,
} from "./entityAddModel.js";

describe("buildEntityAddModelInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddModelInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.uri.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.uri);
    expect(schema.shape.scale.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.scale);
    expect(schema.shape.heading.description).toBe(
      DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.heading,
    );
    expect(schema.shape.pitch.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.pitch);
    expect(schema.shape.roll.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.roll);
    expect(schema.shape.minimumPixelSize.description).toBe(
      DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.minimumPixelSize,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddModelInputSchema({ uri: "custom uri hint" });

    expect(schema.shape.uri.description).toBe("custom uri hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS.position,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddModelInputSchema({ uri: "custom uri hint" });

    expect(
      schema.safeParse({
        id: "m1",
        position: { longitude: 0, latitude: 0 },
        uri: "https://example.com/model.glb",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "m1",
        position: { longitude: 0, latitude: 0 },
        uri: "https://example.com/model.glb",
        minimumPixelSize: 0,
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddModelInputSchema", () => {
  test("is equivalent to buildEntityAddModelInputSchema() with no overrides", () => {
    expect(defaultEntityAddModelInputSchema.shape.id.description).toBe(
      buildEntityAddModelInputSchema().shape.id.description,
    );
  });
});
