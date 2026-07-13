import { describe, expect, test } from "vitest";
import {
  buildEntityAddLabelInputSchema,
  DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS,
  defaultEntityAddLabelInputSchema,
} from "./entityAddLabel.js";

describe("buildEntityAddLabelInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildEntityAddLabelInputSchema();

    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.position,
    );
    expect(schema.shape.text.description).toBe(DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.text);
    expect(schema.shape.font.description).toBe(DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.font);
    expect(schema.shape.fillColor.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.fillColor,
    );
    expect(schema.shape.outlineColor.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.outlineColor,
    );
    expect(schema.shape.outlineWidth.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.outlineWidth,
    );
    expect(schema.shape.pixelOffset.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.pixelOffset,
    );
    expect(schema.shape.description.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.description,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildEntityAddLabelInputSchema({ text: "custom text hint" });

    expect(schema.shape.text.description).toBe("custom text hint");
    expect(schema.shape.id.description).toBe(DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.id);
    expect(schema.shape.position.description).toBe(
      DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS.position,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityAddLabelInputSchema({ text: "custom text hint" });

    expect(
      schema.safeParse({
        id: "l1",
        position: { longitude: 0, latitude: 0 },
        text: "hello",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "l1",
        position: { longitude: 0, latitude: 0 },
        text: "hello",
        outlineWidth: -1,
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddLabelInputSchema", () => {
  test("is equivalent to buildEntityAddLabelInputSchema() with no overrides", () => {
    const schema = buildEntityAddLabelInputSchema();

    expect(defaultEntityAddLabelInputSchema.shape.id.description).toBe(schema.shape.id.description);
    expect(defaultEntityAddLabelInputSchema.shape.text.description).toBe(
      schema.shape.text.description,
    );
  });
});
