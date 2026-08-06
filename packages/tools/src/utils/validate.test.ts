import { describe, expect, test } from "vitest";
import { z } from "zod";
import { parseArgs } from "./validate.js";

describe("parseArgs", () => {
  const shape = z.object({ id: z.string(), count: z.number().positive().optional() });

  test("returns { ok: true, data } for valid input", () => {
    const result = parseArgs(shape, { id: "a", count: 2 });
    expect(result).toEqual({ ok: true, data: { id: "a", count: 2 } });
  });

  test("returns { ok: false, error } for invalid input, without throwing", () => {
    const result = parseArgs(shape, { count: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  test("returns { ok: false, error } for a non-object payload", () => {
    const result = parseArgs(shape, "not an object");
    expect(result.ok).toBe(false);
  });
});
