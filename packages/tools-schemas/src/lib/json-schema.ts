import { z } from "zod";

/** Options accepted by {@link toolInputJsonSchema} — the same params `z.toJSONSchema` takes. */
export type ToolInputJsonSchemaOptions = Parameters<typeof z.toJSONSchema>[1];

type JsonSchemaObject = Record<string, unknown>;

/**
 * Merges the per-branch JSON Schema definitions of a single property (as seen across every
 * branch of a root discriminated union) into one schema.
 *
 * If every variant is a bare `const` (optionally sharing the same `type`/`description`) —
 * exactly what a discriminator field (e.g. `action`, `type`) serializes as — they're collapsed
 * into a single `enum`, matching how an ordinary `z.enum(...)` field would serialize. Otherwise
 * the variants are kept distinct via a nested `anyOf` (fine for function-calling validators,
 * which only reject a *root*-level combinator, not one nested under a property).
 */
function mergePropertyVariants(variants: JsonSchemaObject[]): JsonSchemaObject {
  const unique = [
    ...new Map(variants.map((variant) => [JSON.stringify(variant), variant])).values(),
  ];
  if (unique.length === 1) {
    return unique[0];
  }

  const isConstOnly = unique.every(
    (variant) =>
      "const" in variant &&
      Object.keys(variant).every(
        (key) => key === "const" || key === "type" || key === "description",
      ),
  );
  if (isConstOnly) {
    const { const: _firstConst, ...base } = unique[0];
    return { ...base, enum: unique.map((variant) => variant.const) };
  }

  return { anyOf: unique };
}

/**
 * Flattens a root-level `oneOf`/`anyOf` (produced by a root `z.discriminatedUnion(...)`/
 * `z.union(...)`) into a single flat `type: "object"` schema: every branch's properties are
 * merged (conflicting per-property definitions collapse into an `enum` or a nested `anyOf`, see
 * {@link mergePropertyVariants}), and only fields required in *every* branch stay required.
 *
 * Some function-calling validators (e.g. Azure OpenAI) reject a `parameters`/`inputSchema` whose
 * root is a combinator instead of a plain object — even with `type: "object"` injected alongside
 * it. Flattening avoids that entirely instead of merely papering over the root `type`.
 */
function flattenRootUnion(rest: JsonSchemaObject): JsonSchemaObject {
  const branches = (rest.oneOf ?? rest.anyOf) as JsonSchemaObject[] | undefined;
  if (!branches || branches.length === 0) {
    return rest;
  }

  const properties: Record<string, JsonSchemaObject[]> = {};
  const requiredCounts = new Map<string, number>();
  for (const branch of branches) {
    const branchProperties = (branch.properties ?? {}) as JsonSchemaObject;
    for (const [key, value] of Object.entries(branchProperties)) {
      (properties[key] ??= []).push(value as JsonSchemaObject);
    }
    for (const key of (branch.required ?? []) as string[]) {
      requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1);
    }
  }

  const required = [...requiredCounts.entries()]
    .filter(([, count]) => count === branches.length)
    .map(([key]) => key);
  // Every branch's own properties are already folded into the merged `properties` above, so
  // carrying this over doesn't reject anything a valid branch could legitimately contain.
  const additionalPropertiesFalse = branches.every(
    (branch) => branch.additionalProperties === false,
  );

  const { oneOf: _oneOf, anyOf: _anyOf, ...restWithoutUnion } = rest;
  return {
    ...restWithoutUnion,
    type: "object",
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, variants]) => [key, mergePropertyVariants(variants)]),
    ),
    ...(required.length > 0 ? { required } : {}),
    ...(additionalPropertiesFalse ? { additionalProperties: false } : {}),
  };
}

/**
 * Converts a tool's Zod input schema into a plain JSON Schema object suitable for a
 * function-calling `parameters`/`inputSchema` field.
 *
 * This is the package's single canonical `z.toJSONSchema()` wrapper — every consumer that needs a
 * raw JSON Schema for one of this package's tool schemas (`@cesium-ai/webmcp-cesium`, or any
 * external tool-calling provider) should call this instead of `z.toJSONSchema()` directly. It:
 *
 * - Strips zod's `$schema` meta-schema pointer (most function-calling consumers expect a bare
 *   schema object, not a meta-schema-annotated one).
 * - Flattens a root-level `z.discriminatedUnion(...)`/`z.union(...)` schema (`cameraOrbit`,
 *   `entityAdd`) — which would otherwise serialize as a bare `{ oneOf: [...] }` — into a single
 *   flat `type: "object"` schema (see {@link flattenRootUnion}). That's necessary because some
 *   function-calling validators (e.g. Azure OpenAI) reject a `parameters`/`inputSchema` whose
 *   root is a combinator, even one with `type: "object"` injected alongside it.
 */
export function toolInputJsonSchema(
  schema: z.ZodTypeAny,
  options: ToolInputJsonSchemaOptions = { target: "draft-07" },
): Record<string, unknown> {
  const { $schema: _$schema, ...rest } = z.toJSONSchema(schema, options) as Record<string, unknown>;
  if ("oneOf" in rest || "anyOf" in rest) {
    return flattenRootUnion(rest);
  }
  return rest;
}
