import { describe, expect, test } from "vitest";
import {
  buildImageryAddInputSchema,
  DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS,
  defaultImageryAddInputSchema,
} from "./imageryAdd.js";

describe("buildImageryAddInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildImageryAddInputSchema();

    expect(schema.shape.type.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.type);
    expect(schema.shape.url.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.url);
    expect(schema.shape.name.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.layers.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.layers);
    expect(schema.shape.style.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.style);
    expect(schema.shape.format.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.format);
    expect(schema.shape.tileMatrixSetID.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.tileMatrixSetID,
    );
    expect(schema.shape.maximumLevel.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.maximumLevel,
    );
    expect(schema.shape.minimumLevel.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.minimumLevel,
    );
    expect(schema.shape.assetId.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.assetId);
    expect(schema.shape.key.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.key);
    expect(schema.shape.alpha.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.alpha);
    expect(schema.shape.show.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.show);
    expect(schema.shape.rectangle.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.rectangle,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildImageryAddInputSchema({ alpha: "custom alpha hint" });

    expect(schema.shape.alpha.description).toBe("custom alpha hint");
    expect(schema.shape.type.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.type);
    expect(schema.shape.url.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.url);
    expect(schema.shape.name.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.name);
    expect(schema.shape.layers.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.layers);
    expect(schema.shape.style.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.style);
    expect(schema.shape.format.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.format);
    expect(schema.shape.tileMatrixSetID.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.tileMatrixSetID,
    );
    expect(schema.shape.maximumLevel.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.maximumLevel,
    );
    expect(schema.shape.minimumLevel.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.minimumLevel,
    );
    expect(schema.shape.assetId.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.assetId);
    expect(schema.shape.key.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.key);
    expect(schema.shape.show.description).toBe(DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.show);
    expect(schema.shape.rectangle.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.rectangle,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildImageryAddInputSchema({ alpha: "custom alpha hint" });

    expect(
      schema.safeParse({
        type: "OpenStreetMapImageryProvider",
        url: "https://tile.openstreetmap.org",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        type: "OpenStreetMapImageryProvider",
        url: "https://tile.openstreetmap.org",
        alpha: 2,
      }).success,
    ).toBe(false);
  });
});

describe("defaultImageryAddInputSchema", () => {
  test("is equivalent to buildImageryAddInputSchema() with no overrides", () => {
    expect(defaultImageryAddInputSchema.shape.type.description).toBe(
      DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS.type,
    );
  });
});
