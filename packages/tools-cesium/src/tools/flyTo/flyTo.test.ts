import { describe, expect, test } from "vitest";
import {
  buildFlyToInputSchema,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
  defaultFlyToInputSchema,
} from "./flyTo.js";

describe("buildFlyToInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildFlyToInputSchema();

    expect(schema.shape.latitude.description).toBe(DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.latitude);
    expect(schema.shape.longitude.description).toBe(DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.longitude);
    expect(schema.shape.altitude.description).toBe(DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.altitude);
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildFlyToInputSchema({ altitude: "custom altitude hint" });

    expect(schema.shape.altitude.description).toBe("custom altitude hint");
    expect(schema.shape.latitude.description).toBe(DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.latitude);
    expect(schema.shape.longitude.description).toBe(DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.longitude);
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildFlyToInputSchema({ altitude: "custom altitude hint" });

    expect(schema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(true);
    expect(schema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
  });
});

describe("defaultFlyToInputSchema", () => {
  test("is equivalent to buildFlyToInputSchema() with no overrides", () => {
    expect(defaultFlyToInputSchema.shape.latitude.description).toBe(
      DEFAULT_FLY_TO_FIELD_DESCRIPTIONS.latitude,
    );
  });
});
