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

  test("flattens a typeless root oneOf (root discriminated union) into a flat object schema", () => {
    const result = toolInputJsonSchema(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("start") }),
        z.object({ action: z.literal("stop") }),
      ]),
    );

    expect(result.type).toBe("object");
    expect(result).not.toHaveProperty("oneOf");
    expect(result).not.toHaveProperty("anyOf");
    expect(result.properties).toEqual({
      action: { type: "string", enum: ["start", "stop"] },
    });
    expect(result.required).toEqual(["action"]);
  });

  test("preserves additionalProperties: false from every branch onto the flattened schema", () => {
    const result = toolInputJsonSchema(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("start") }),
        z.object({ action: z.literal("stop") }),
      ]),
    );

    expect(result.additionalProperties).toBe(false);
  });

  test("fixes the real cameraOrbit root discriminated-union schema", () => {
    const result = toolInputJsonSchema(cameraOrbitInputShape);

    expect(result.type).toBe("object");
    expect(result).not.toHaveProperty("oneOf");
    expect(result).not.toHaveProperty("anyOf");
    expect(result.required).toEqual(["action"]);
    const properties = result.properties as Record<string, unknown>;
    expect(properties.action).toMatchObject({ enum: ["start", "stop"] });
    expect(properties).toHaveProperty("speed");
    expect(properties).toHaveProperty("direction");
  });

  test("fixes the real entityAdd root discriminated-union schema", () => {
    const result = toolInputJsonSchema(entityAddInputShape);

    expect(result.type).toBe("object");
    expect(result).not.toHaveProperty("oneOf");
    expect(result).not.toHaveProperty("anyOf");
    expect(result.required).toEqual(["type", "data"]);
    const properties = result.properties as Record<string, unknown>;
    expect(properties.type).toMatchObject({ enum: expect.arrayContaining(["point", "wall"]) });
    // `data`'s shape genuinely differs per entity type (point vs. polygon vs. model, ...), so it
    // stays a nested `anyOf` — only a *root*-level combinator is rejected by strict validators.
    expect(properties.data).toHaveProperty("anyOf");
  });
});
