import {
  generateVerifiedCesiumCode,
  DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
  defaultExecuteCesiumCodeInputSchema,
} from "@cesium-ai/codegen-cesium";
import { tool, type LanguageModel, type Tool } from "ai";

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
}: CreateExecuteCesiumCodeToolOptions): Tool {
  return tool({
    description: DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
    inputSchema: defaultExecuteCesiumCodeInputSchema,
    execute: async ({ intent }: { intent: string }): Promise<ExecuteCesiumCodeResult> => {
      try {
        const result = await generateVerifiedCesiumCode({ intent, model, maxSkills, maxAttempts });
        return result.verified ? { code: result.code } : { error: result.error };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}
