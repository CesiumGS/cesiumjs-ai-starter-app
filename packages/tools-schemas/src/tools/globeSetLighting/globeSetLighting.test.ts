import { describe, expect, test } from "vitest";
import {
  buildGlobeSetLightingInputSchema,
  DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS,
  defaultGlobeSetLightingInputSchema,
} from "./globeSetLighting.js";

describe("buildGlobeSetLightingInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildGlobeSetLightingInputSchema();

    expect(schema.shape.enableLighting.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableLighting,
    );
    expect(schema.shape.enableDynamicAtmosphere.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableDynamicAtmosphere,
    );
    expect(schema.shape.enableSunLighting.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableSunLighting,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildGlobeSetLightingInputSchema({
      enableSunLighting: "custom sun lighting hint",
    });

    expect(schema.shape.enableSunLighting.description).toBe("custom sun lighting hint");
    expect(schema.shape.enableLighting.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableLighting,
    );
    expect(schema.shape.enableDynamicAtmosphere.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableDynamicAtmosphere,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildGlobeSetLightingInputSchema({
      enableSunLighting: "custom sun lighting hint",
    });

    expect(schema.safeParse({ enableLighting: true }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("defaultGlobeSetLightingInputSchema", () => {
  test("is equivalent to buildGlobeSetLightingInputSchema() with no overrides", () => {
    expect(defaultGlobeSetLightingInputSchema.shape.enableLighting.description).toBe(
      DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS.enableLighting,
    );
  });
});
