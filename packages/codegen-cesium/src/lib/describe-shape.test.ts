import { z } from "zod";
import { describe, expect, test } from "vitest";
import { buildDescribedSchema, describeShape } from "./describe-shape.js";

describe("describeShape", () => {
  test("applies the matching description to every field in the shape", () => {
    const shape = { latitude: z.number(), longitude: z.number() };

    const described = describeShape(shape, { latitude: "lat hint", longitude: "lon hint" });

    expect(described.shape.latitude.description).toBe("lat hint");
    expect(described.shape.longitude.description).toBe("lon hint");
  });

  test("preserves each field's own validation rules", () => {
    const shape = { altitude: z.number().positive() };

    const described = describeShape(shape, { altitude: "altitude hint" });

    expect(described.safeParse({ altitude: -1 }).success).toBe(false);
    expect(described.safeParse({ altitude: 10 }).success).toBe(true);
  });
});

describe("buildDescribedSchema", () => {
  const shape = { latitude: z.number(), longitude: z.number() };
  const defaults = { latitude: "default lat", longitude: "default lon" };

  test("decorates the shape with the defaults when no overrides are given", () => {
    const schema = buildDescribedSchema(shape, defaults);

    expect(schema.shape.latitude.description).toBe("default lat");
    expect(schema.shape.longitude.description).toBe("default lon");
  });

  test("merges overrides over the defaults before describing the shape", () => {
    const schema = buildDescribedSchema(shape, defaults, { latitude: "custom lat" });

    expect(schema.shape.latitude.description).toBe("custom lat");
    expect(schema.shape.longitude.description).toBe("default lon");
  });
});
