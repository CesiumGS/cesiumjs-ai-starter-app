import { describe, expect, test } from "vitest";
import {
  buildImageryListInputSchema,
  DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS,
  defaultImageryListInputSchema,
} from "./imageryList.js";

describe("buildImageryListInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildImageryListInputSchema();

    expect(schema.shape.includeDetails.description).toBe(
      DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS.includeDetails,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildImageryListInputSchema({ includeDetails: "custom detail hint" });

    expect(schema.shape.includeDetails.description).toBe("custom detail hint");
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildImageryListInputSchema({ includeDetails: "custom detail hint" });

    expect(schema.safeParse({ includeDetails: true }).success).toBe(true);
    expect(schema.safeParse({ includeDetails: "yes" }).success).toBe(false);
  });
});

describe("defaultImageryListInputSchema", () => {
  test("is equivalent to buildImageryListInputSchema() with no overrides", () => {
    expect(defaultImageryListInputSchema.shape.includeDetails.description).toBe(
      DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS.includeDetails,
    );
  });
});
