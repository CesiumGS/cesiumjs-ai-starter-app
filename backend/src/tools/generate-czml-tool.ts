import {
  generateVerifiedCzml,
  DEFAULT_GENERATE_CZML_DESCRIPTION,
  defaultGenerateCzmlInputSchema,
  type CodegenLogger,
  type CodegenMetrics,
} from "@cesium-ai/codegen-czml";
import { tool, type LanguageModel, type Tool } from "ai";

/**
 * The structured result posted back to the agent loop (and streamed to the browser as a
 * `tool-output-available` chunk) after a `generateCzml` call runs. On success, returns the
 * verified CZML document plus its summary. On failure, returns an error object.
 */
export type GenerateCzmlResult =
  { czml: Record<string, unknown>[]; description: string } | { error: string };

export interface CreateGenerateCzmlToolOptions {
  /** The resolved language model to generate CZML with. */
  model: LanguageModel;
  /** Max regeneration attempts if a generation fails verification. Passed through to `generateVerifiedCzml`. */
  maxAttempts?: number;
  /** Hard cap on generated packet count. Passed through to `generateVerifiedCzml`. */
  maxPackets?: number;
  /** Hard cap on generated CZML size in characters. Passed through to `generateVerifiedCzml`. */
  maxLength?: number;
  /** Extra instructions appended to the generation prompt. Passed through to `generateVerifiedCzml`. */
  extraInstructions?: string;
  /** Structured logger for generation attempts/failures. Passed through to `generateVerifiedCzml`. */
  logger?: CodegenLogger;
  /** Metrics sink for token usage and generation duration. Passed through to `generateVerifiedCzml`. */
  metrics?: CodegenMetrics;
}

/**
 * This app's server-executed `generateCzml` tool: unlike the viewer tools in
 * `@cesium-ai/tools-schemas` (schema-only, client executed against a live `Viewer`), this tool's
 * intent must be turned into a verified CZML document before it can be loaded anywhere — that's
 * `@cesium-ai/codegen-czml`'s job, which is also where this tool's schema-only library
 * definition lives. This factory builds an executable AI SDK `Tool` around `generateVerifiedCzml`,
 * using that library's model-facing input schema so the description and field hint the model
 * sees stay in lockstep with the schema-only version this replaces (see `app.ts`, which merges
 * this tool in alongside `createCesiumTools`'s viewer tools).
 *
 * `execute` never throws: any unexpected failure is caught and reported back as an `{ error }`
 * result, exactly like a normal verification failure, so a single bad call can't crash the agent
 * loop. A `{ czml }` result only means the document passed verification — the frontend still has
 * to actually load it into the live `Viewer` and report the real outcome (see `app.ts`'s
 * `stopAfterTools`).
 */
export function createGenerateCzmlTool({
  model,
  maxAttempts,
  maxPackets,
  maxLength,
  extraInstructions,
  logger,
  metrics,
}: CreateGenerateCzmlToolOptions): Tool {
  return tool({
    description: DEFAULT_GENERATE_CZML_DESCRIPTION,
    inputSchema: defaultGenerateCzmlInputSchema,
    execute: async ({ intent }: { intent: string }): Promise<GenerateCzmlResult> => {
      try {
        const result = await generateVerifiedCzml({
          intent,
          model,
          maxAttempts,
          maxPackets,
          maxLength,
          extraInstructions,
          logger,
          metrics,
        });
        return result.verified
          ? { czml: result.czml, description: result.description }
          : { error: result.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger?.error("generateCzml tool threw unexpectedly", { error: message });
        return { error: message };
      }
    },
  });
}
