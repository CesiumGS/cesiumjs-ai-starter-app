import { describe, expect, test } from "vitest";
import { buildEntityListInputSchema, defaultEntityListInputSchema } from "./entityList.js";

describe("buildEntityListInputSchema", () => {
  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildEntityListInputSchema();

    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(false);
  });
});

describe("defaultEntityListInputSchema", () => {
  test("is equivalent to buildEntityListInputSchema() with no overrides", () => {
    expect(Object.keys(defaultEntityListInputSchema.shape)).toEqual(
      Object.keys(buildEntityListInputSchema().shape),
    );
  });
});
