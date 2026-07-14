import { describe, expect, test } from "vitest";
import {
  buildExecuteCesiumCodeInputSchema,
  DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS,
  defaultExecuteCesiumCodeInputSchema,
} from "./executeCesiumCode.js";

describe("buildExecuteCesiumCodeInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildExecuteCesiumCodeInputSchema();

    expect(schema.shape.intent.description).toBe(
      DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS.intent,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildExecuteCesiumCodeInputSchema({ intent: "custom intent hint" });

    expect(schema.shape.intent.description).toBe("custom intent hint");
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildExecuteCesiumCodeInputSchema({ intent: "custom intent hint" });

    expect(schema.safeParse({ intent: "fly to Paris" }).success).toBe(true);
    expect(schema.safeParse({ intent: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("defaultExecuteCesiumCodeInputSchema", () => {
  test("is equivalent to buildExecuteCesiumCodeInputSchema() with no overrides", () => {
    expect(defaultExecuteCesiumCodeInputSchema.shape.intent.description).toBe(
      DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS.intent,
    );
  });
});
