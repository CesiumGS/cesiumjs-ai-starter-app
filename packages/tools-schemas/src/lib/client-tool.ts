import { tool, type Tool } from "ai";
import type { z } from "zod";

/**
 * The config shape every client-side Cesium tool accepts: an optional
 * description override, optional per-field `.describe()` hint overrides, or a
 * full input-schema replacement (which takes precedence over
 * `fieldDescriptions`). Parameterized over the tool's own field-descriptions
 * type so each tool keeps its own field names typed.
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
 * Builds a client-side-executed tool: a description and an input schema, and
 * nothing else. Every CesiumJS tool in this package is defined this way — no
 * `execute` — because the AI SDK streams the tool call to the browser, which
 * runs it against the live `Viewer` and streams the result back.
 */
export function createClientTool(description: string, inputSchema: z.ZodTypeAny): Tool {
  return tool({ description, inputSchema });
}

/**
 * Builds a tool's `createX(config)` factory: applies `config.description` /
 * `config.inputSchema` over the tool's own default description and schema
 * builder, then hands the result to {@link createClientTool}. Every tool's
 * `createX` function in this package has this exact body — a
 * `??` over its own defaults — so a new tool just plugs in its default
 * description and `buildXInputSchema` here instead of rewriting it.
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
