import { z } from "zod";

/** Options accepted by {@link toolInputJsonSchema} — the same params `z.toJSONSchema` takes. */
export type ToolInputJsonSchemaOptions = Parameters<typeof z.toJSONSchema>[1];

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
 * - Guards against a root-level `z.discriminatedUnion(...)` schema (`cameraOrbit`, `entityAdd`)
 *   serializing as a bare `{ oneOf: [...] }` with no root `type: "object"`. That's valid JSON
 *   Schema on its own, but some function-calling validators (e.g. Azure OpenAI) reject a
 *   `parameters`/`inputSchema` object that has no root `type: "object"` — this injects it when a
 *   root `oneOf`/`anyOf` would otherwise be typeless.
 */
export function toolInputJsonSchema(
  schema: z.ZodTypeAny,
  options: ToolInputJsonSchemaOptions = { target: "draft-07" },
): Record<string, unknown> {
  const { $schema: _$schema, ...rest } = z.toJSONSchema(schema, options) as Record<string, unknown>;
  if (("oneOf" in rest || "anyOf" in rest) && !("type" in rest)) {
    return { type: "object", ...rest };
  }
  return rest;
}
