import { z } from "zod";
import { describe, expect, test } from "vitest";
import { toolInputJsonSchema } from "./json-schema.js";
import { cameraOrbitInputShape } from "../tools/cameraOrbit/cameraOrbit.schema.js";
import { entityAddInputShape } from "../tools/entityAdd/entityAdd.schema.js";

describe("toolInputJsonSchema", () => {
  test("strips zod's $schema meta-schema pointer", () => {
    const result = toolInputJsonSchema(z.object({ foo: z.string() }));

    expect(result).not.toHaveProperty("$schema");
  });

  test("leaves an ordinary object schema's root type untouched", () => {
    const result = toolInputJsonSchema(z.object({ foo: z.string() }));

    expect(result.type).toBe("object");
  });

  test("injects a root type: object on a typeless root oneOf (root discriminated union)", () => {
    const result = toolInputJsonSchema(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("start") }),
        z.object({ action: z.literal("stop") }),
      ]),
    );

    expect(result.type).toBe("object");
    expect(result).toHaveProperty("oneOf");
  });

  test("fixes the real cameraOrbit root discriminated-union schema", () => {
    const result = toolInputJsonSchema(cameraOrbitInputShape);

    expect(result.type).toBe("object");
  });

  test("fixes the real entityAdd root discriminated-union schema", () => {
    const result = toolInputJsonSchema(entityAddInputShape);

    expect(result.type).toBe("object");
  });
});
