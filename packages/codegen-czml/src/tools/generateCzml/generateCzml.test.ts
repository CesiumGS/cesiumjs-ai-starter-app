import { describe, expect, test } from "vitest";
import {
  buildGenerateCzmlInputSchema,
  DEFAULT_GENERATE_CZML_DESCRIPTION,
  DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS,
  defaultGenerateCzmlInputSchema,
} from "./generateCzml.js";

describe("buildGenerateCzmlInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildGenerateCzmlInputSchema();

    expect(schema.shape.intent.description).toBe(DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS.intent);
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildGenerateCzmlInputSchema({ intent: "custom intent hint" });

    expect(schema.shape.intent.description).toBe("custom intent hint");
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildGenerateCzmlInputSchema({ intent: "custom intent hint" });

    expect(schema.safeParse({ intent: "a satellite orbit" }).success).toBe(true);
    expect(schema.safeParse({ intent: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("defaultGenerateCzmlInputSchema", () => {
  test("is equivalent to buildGenerateCzmlInputSchema() with no overrides", () => {
    expect(defaultGenerateCzmlInputSchema.shape.intent.description).toBe(
      DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS.intent,
    );
  });
});

describe("DEFAULT_GENERATE_CZML_DESCRIPTION", () => {
  test("requires clarification instead of invented scene values", () => {
    expect(DEFAULT_GENERATE_CZML_DESCRIPTION).toContain(
      "ask the user for clarification instead of calling the tool",
    );
    expect(DEFAULT_GENERATE_CZML_DESCRIPTION).toContain(
      "never invent, estimate, or silently choose values",
    );
    expect(DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS.intent).toContain(
      "only values explicitly provided or confirmed by the user",
    );
  });
});
