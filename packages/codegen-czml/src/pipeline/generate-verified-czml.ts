/**
 * Orchestration entry point: turns a natural-language intent into a **verified** CZML document.
 * Mirrors `@cesium-ai/codegen-cesium`'s `generateVerifiedCesiumCode` shape (prompt building ->
 * model call -> verify -> retry-with-feedback) and verifies via `verifyCzml` (zod + a real
 * `CzmlDataSource` parse) instead of AST analysis — CZML is declarative data, not code, so there
 * is nothing to statically analyze for unsafe operations, only structural/semantic validity to
 * check.
 *
 * Feature-domain skill grounding is dynamic/model-driven rather than harness-computed: the model
 * is shown only the skill catalog (names/descriptions, see `prompt-builder.ts`) and may call the
 * `loadSkill` tool (see `skill-tool.ts`) to pull in a skill's full body as needed, so this uses
 * `generateText` with `tools`/`stopWhen`/`output: Output.object(...)` (structured output alongside
 * tool calls) instead of `generateObject`, which supports neither.
 *
 * Model-agnostic by design: this function receives an already-resolved `LanguageModel` from the
 * caller and never selects a provider or reads API keys itself.
 */
import { generateText, stepCountIs, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { buildCzmlPrompt } from "./prompt-builder.js";
import { verifyCzml, czmlPacketShape } from "./czml-verifier.js";
import { loadCzmlSkills } from "./skills-loader.js";
import { createLoadSkillTool } from "./skill-tool.js";
import { noopCodegenLogger, type CodegenLogger } from "../logger.js";
import { noopCodegenMetrics, type CodegenMetrics } from "../metrics.js";
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_MAX_TOOL_STEPS } from "./constants.js";

/** The structured object the model is asked to produce for one generation attempt. */
const czmlGenerationObjectShape = z.object({
  czml: z.array(czmlPacketShape).min(1),
  description: z.string().min(1),
});

export interface GenerateVerifiedCzmlOptions {
  /** The user's natural-language intent, e.g. "animate a satellite orbit over Europe for 24 hours". */
  intent: string;
  /** The resolved language model to generate with. */
  model: LanguageModel;
  /** Max regeneration attempts if a generation fails verification. Default 3. */
  maxAttempts?: number;
  /** Hard cap on generated packet count, passed through to `verifyCzml`. */
  maxPackets?: number;
  /** Hard cap on generated CZML size in characters, passed through to `verifyCzml`. */
  maxLength?: number;
  /** Max steps (each a `loadSkill` tool call, or the final structured-output step) the model may take per generation attempt. Defaults to {@link DEFAULT_MAX_TOOL_STEPS}. */
  maxToolSteps?: number;
  /** Optional extra instructions appended to the generation prompt's output rules. */
  extraInstructions?: string;
  /** Structured logger for generation attempts/failures. Defaults to a no-op (silent) logger. */
  logger?: CodegenLogger;
  /** Metrics sink for token usage and generation duration. Defaults to a no-op. */
  metrics?: CodegenMetrics;
}

export type GenerateVerifiedCzmlResult =
  | { verified: true; czml: Record<string, unknown>[]; description: string; entityCount: number }
  | { verified: false; error: string; violations?: string[] };

/**
 * Generates a CZML document for `intent` and verifies it (structurally and semantically, via
 * `verifyCzml`) before returning it. Retries generation (feeding the previous attempt's
 * violations back to the model as extra prompt context) up to `maxAttempts` total attempts.
 * Never returns unverified CZML as if it were verified.
 */
export async function generateVerifiedCzml(
  options: GenerateVerifiedCzmlOptions,
): Promise<GenerateVerifiedCzmlResult> {
  const { intent, model, maxPackets, maxLength, extraInstructions } = options;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxToolSteps = options.maxToolSteps ?? DEFAULT_MAX_TOOL_STEPS;
  const logger = options.logger ?? noopCodegenLogger;
  const metrics = options.metrics ?? noopCodegenMetrics;

  logger.debug("Generating CZML", { intent, maxAttempts, maxToolSteps });

  const skills = loadCzmlSkills();
  const loadSkill = createLoadSkillTool(skills, (skillName) => {
    logger.debug("Model loaded a CZML skill via loadSkill tool", { intent, skill: skillName });
  });

  const basePrompt = buildCzmlPrompt({
    intent,
    availableSkills: skills.map(({ name, description }) => ({ name, description })),
    extraInstructions,
  });
  const correctionPrompt = (violations: string[]) =>
    `${basePrompt}

Your previous attempt was rejected by verification for the following reason(s):
${violations.map((v) => `- ${v}`).join("\n")}

Generate a corrected CZML document that avoids all of the above issues, still following all output rules above.`;

  let lastViolations: string[] | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = lastViolations ? correctionPrompt(lastViolations) : basePrompt;
    const attemptStart = Date.now();

    let generated: { czml: Record<string, unknown>[]; description: string };
    try {
      const result = await generateText({
        model,
        prompt,
        tools: { loadSkill },
        stopWhen: stepCountIs(maxToolSteps),
        output: Output.object({ schema: czmlGenerationObjectShape }),
        // CZML packets are deliberately loosely-typed (`z.record`, see czml-verifier.ts) since
        // real CZML properties vary per packet — that produces a `propertyNames` keyword in the
        // JSON schema, which OpenAI's *strict* structured-output mode rejects
        // ("'propertyNames' is not permitted"). Other providers ignore unknown providerOptions
        // keys, so this only affects OpenAI.
        providerOptions: { openai: { strictJsonSchema: false } },
      });
      generated = result.output;
      if (result.usage) {
        metrics.recordTokenUsage(
          {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          },
          { attempt },
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn("Model call failed during CZML generation", { attempt, error: lastError });
      metrics.recordGenerationDuration(Date.now() - attemptStart, {
        attempt,
        outcome: "model_error",
      });
      continue;
    }

    const verifyResult = await verifyCzml(generated.czml, { maxPackets, maxLength });

    if (verifyResult.verified) {
      logger.info("Generated and verified CZML", {
        attempt,
        entityCount: verifyResult.entityCount,
      });
      metrics.recordGenerationDuration(Date.now() - attemptStart, { attempt, outcome: "verified" });
      return {
        verified: true,
        czml: generated.czml,
        description: generated.description,
        entityCount: verifyResult.entityCount,
      };
    }

    logger.warn("Generated CZML failed verification", {
      attempt,
      violationCount: verifyResult.violations.length,
      violations: verifyResult.violations,
    });
    metrics.recordGenerationDuration(Date.now() - attemptStart, { attempt, outcome: "rejected" });
    lastViolations = verifyResult.violations;
  }

  logger.error("CZML generation failed after all attempts", {
    maxAttempts,
    error: lastError,
    violations: lastViolations,
  });

  return {
    verified: false,
    error: lastError ?? "Generated CZML failed verification after all attempts.",
    ...(lastViolations ? { violations: lastViolations } : {}),
  };
}
