import { describe, expect, test } from "vitest";
import {
  buildClockControlInputSchema,
  DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS,
  defaultClockControlInputSchema,
} from "./clockControl.js";

describe("buildClockControlInputSchema", () => {
  test("with no overrides, every field carries its default hint", () => {
    const schema = buildClockControlInputSchema();

    expect(schema.shape.action.description).toBe(DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.action);
    expect(schema.shape.clock.description).toBe(DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.clock);
    expect(schema.shape.currentTime.description).toBe(
      DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.currentTime,
    );
    expect(schema.shape.multiplier.description).toBe(
      DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.multiplier,
    );
  });

  test("a partial override replaces only the named field's hint", () => {
    const schema = buildClockControlInputSchema({ multiplier: "custom multiplier hint" });

    expect(schema.shape.multiplier.description).toBe("custom multiplier hint");
    expect(schema.shape.action.description).toBe(DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.action);
    expect(schema.shape.clock.description).toBe(DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.clock);
    expect(schema.shape.currentTime.description).toBe(
      DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.currentTime,
    );
  });

  test("still enforces the same structural rules as the default schema", () => {
    const schema = buildClockControlInputSchema({ multiplier: "custom multiplier hint" });

    expect(schema.safeParse({ action: "setMultiplier", multiplier: 100 }).success).toBe(true);
    expect(schema.safeParse({ action: "unknown" }).success).toBe(false);
  });
});

describe("defaultClockControlInputSchema", () => {
  test("is equivalent to buildClockControlInputSchema() with no overrides", () => {
    expect(defaultClockControlInputSchema.shape.action.description).toBe(
      DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS.action,
    );
  });
});
