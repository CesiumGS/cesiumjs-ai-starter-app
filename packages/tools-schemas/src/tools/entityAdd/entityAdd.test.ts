import { describe, expect, test } from "vitest";
import {
  buildEntityAddInputSchema,
  DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS,
  defaultEntityAddInputSchema,
} from "./entityAdd.js";

describe("buildEntityAddInputSchema", () => {
  test("with no overrides, top-level fields carry default hints", () => {
    const schema = buildEntityAddInputSchema();

    const pointOption = schema.options.find((option) => option.shape.type.value === "point");
    expect(pointOption?.shape.type.description).toBe(DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS.type);
    expect(pointOption?.shape.data.description).toBe(DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS.data);
  });

  test("a partial override replaces only the named hint", () => {
    const schema = buildEntityAddInputSchema({ type: "custom type hint" });

    const pointOption = schema.options.find((option) => option.shape.type.value === "point");
    expect(pointOption?.shape.type.description).toBe("custom type hint");
    expect(pointOption?.shape.data.description).toBe(DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS.data);
  });

  test("still enforces per-type structural rules", () => {
    const schema = buildEntityAddInputSchema();

    expect(
      schema.safeParse({
        type: "point",
        data: { id: "p1", position: { longitude: 0, latitude: 0 } },
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        type: "point",
        data: { position: { longitude: 0, latitude: 0 } },
      }).success,
    ).toBe(false);
  });
});

describe("defaultEntityAddInputSchema", () => {
  test("is equivalent to buildEntityAddInputSchema() with no overrides", () => {
    const built = buildEntityAddInputSchema();
    const builtPoint = built.options.find((option) => option.shape.type.value === "point");
    const defaultPoint = defaultEntityAddInputSchema.options.find(
      (option) => option.shape.type.value === "point",
    );

    expect(defaultPoint?.shape.type.description).toBe(builtPoint?.shape.type.description);
    expect(defaultPoint?.shape.data.description).toBe(builtPoint?.shape.data.description);
  });
});
