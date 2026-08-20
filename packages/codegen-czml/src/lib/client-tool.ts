import { tool, type Tool } from "ai";
import type { z } from "zod";

/**
 * The config shape the codegen-czml tool accepts: an optional description override, optional
 * per-field `.describe()` hint overrides, or a full input-schema replacement (which takes
 * precedence over `fieldDescriptions`). Mirrors `@cesium-ai/codegen-cesium`'s identical helper
 * (duplicated rather than imported — see `merge-descriptions.ts`'s doc comment for why).
 */
export interface ClientToolConfig<FieldDescriptions> {
  /** Override the model-facing description. Defaults to the tool's own default description. */
  description?: string;
  /** Override individual field `.describe()` hints. Merged over the tool's defaults. Ignored when `inputSchema` is supplied. */
  fieldDescriptions?: FieldDescriptions;
  /** Fully replace the input schema. Takes precedence over `fieldDescriptions`. */
  inputSchema?: z.ZodTypeAny;
}

/**
 * Builds a schema-only tool definition: a description and an input schema, and nothing else — no
 * `execute`. `generateCzml`'s library copy is defined this way so a host application can swap in
 * its own server-executed version (see `backend/src/tools/generate-czml-tool.ts`) while reusing
 * this package's description/schema as the single source of truth.
 */
export function createClientTool(description: string, inputSchema: z.ZodTypeAny): Tool {
  return tool({ description, inputSchema });
}

/**
 * Builds a tool's `createX(config)` factory: applies `config.description` / `config.inputSchema`
 * over the tool's own default description and schema builder, then hands the result to
 * {@link createClientTool}.
 */
export function createToolFactory<FieldDescriptions>(
  defaultDescription: string,
  buildInputSchema: (fieldDescriptions?: FieldDescriptions) => z.ZodTypeAny,
): (config?: ClientToolConfig<FieldDescriptions>) => Tool {
  return (config: ClientToolConfig<FieldDescriptions> = {}) =>
    createClientTool(
      config.description ?? defaultDescription,
      config.inputSchema ?? buildInputSchema(config.fieldDescriptions),
    );
}
