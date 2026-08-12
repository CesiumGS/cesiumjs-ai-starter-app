import {
  generateVerifiedCesiumCode,
  DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
  defaultExecuteCesiumCodeInputSchema,
  CODEGEN_CESIUM_TOOL_NAMES,
  type RuntimeCodegenFeedback,
  type CodegenLogger,
  type CodegenMetrics,
} from "@cesium-ai/codegen-cesium";
import { tool, type LanguageModel, type ModelMessage, type Tool } from "ai";

/**
 * The structured result posted back to the agent loop (and streamed to the
 * browser as a `tool-output-available` chunk) after an `executeCesiumCode`
 * call runs. On success, returns only the verified code. On failure, returns
 * an error object.
 */
export type ExecuteCesiumCodeResult = { code: string } | { error: string };

export interface CreateExecuteCesiumCodeToolOptions {
  /** The resolved language model to generate CesiumJS code with. */
  model: LanguageModel;
  /** Max number of matched skills to inline as grounding context. Passed through to `generateVerifiedCesiumCode`. */
  maxSkills?: number;
  /** Max regeneration attempts if a generation fails verification. Passed through to `generateVerifiedCesiumCode`. */
  maxAttempts?: number;
  /** Hard cap on generated source size in characters. Passed through to `generateVerifiedCesiumCode`. */
  maxLength?: number;
  /** Hard cap on generated line count. Passed through to `generateVerifiedCesiumCode`. */
  maxLines?: number;
  /** Free-identifier allowlist. Passed through to `generateVerifiedCesiumCode`. */
  allowedSymbols?: readonly string[];
  /** Extra instructions appended to the generation prompt. Passed through to `generateVerifiedCesiumCode`. */
  extraInstructions?: string;
  /** Structured logger for generation attempts/failures. Passed through to `generateVerifiedCesiumCode`. */
  logger?: CodegenLogger;
  /** Metrics sink for token usage, skill-match scores, and generation duration. Passed through to `generateVerifiedCesiumCode`. */
  metrics?: CodegenMetrics;
}

/** Finds the latest browser-sandbox failure returned for an earlier executeCesiumCode call. */
export function findLatestRuntimeCodegenFeedback(
  messages: ModelMessage[],
): RuntimeCodegenFeedback | undefined {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (message.role !== "tool" || !Array.isArray(message.content)) continue;

    for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex--) {
      const part = message.content[partIndex];
      if (
        part.type !== "tool-result" ||
        part.toolName !== CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode
      ) {
        continue;
      }

      if (
        part.output.type !== "json" ||
        !part.output.value ||
        typeof part.output.value !== "object" ||
        Array.isArray(part.output.value)
      ) {
        return undefined;
      }

      const value = part.output.value as Record<string, unknown>;
      if (typeof value.code === "string" && typeof value.executionError === "string") {
        return { previousCode: value.code, executionError: value.executionError };
      }
      return undefined;
    }
  }

  return undefined;
}

/**
 * This app's server-executed `executeCesiumCode` tool: unlike the viewer
 * tools in `@cesium-ai/tools-cesium` (schema-only, client executed against a
 * live `Viewer`), this tool's intent must be turned into verified CesiumJS
 * code before it can run anywhere — that's `@cesium-ai/codegen-cesium`'s job,
 * which is also where this tool's schema-only library definition lives (see
 * `@cesium-ai/codegen-cesium`'s `executeCesiumCode.ts`). This factory builds
 * an executable AI SDK `Tool` around `generateVerifiedCesiumCode`, using that
 * library's model-facing input schema
 * ({@link defaultExecuteCesiumCodeInputSchema}) so the description and field
 * hints the model sees stay in lockstep with the schema-only version this
 * replaces (see `app.ts`, which merges this tool in alongside
 * `createCesiumTools`'s viewer tools).
 *
 * `execute` never throws: any unexpected failure (a network error, a bug in
 * the codegen pipeline, ...) is caught and reported back as an
 * `{ error }` result, exactly like a normal verification failure, so a single
 * bad call can't crash the agent loop.
 */
export function createExecuteCesiumCodeTool({
  model,
  maxSkills,
  maxAttempts,
  maxLength,
  maxLines,
  allowedSymbols,
  extraInstructions,
  logger,
  metrics,
}: CreateExecuteCesiumCodeToolOptions): Tool {
  return tool({
    description: DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
    inputSchema: defaultExecuteCesiumCodeInputSchema,
    execute: async (
      { intent }: { intent: string },
      { messages },
    ): Promise<ExecuteCesiumCodeResult> => {
      try {
        const runtimeFeedback = findLatestRuntimeCodegenFeedback(messages);
        const result = await generateVerifiedCesiumCode({
          intent,
          model,
          maxSkills,
          maxAttempts,
          maxLength,
          maxLines,
          allowedSymbols,
          extraInstructions,
          logger,
          metrics,
          ...(runtimeFeedback ? { runtimeFeedback } : {}),
        });
        return result.verified ? { code: result.code } : { error: result.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger?.error("executeCesiumCode tool threw unexpectedly", { error: message });
        return { error: message };
      }
    },
  });
}
