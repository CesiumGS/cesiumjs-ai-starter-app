/**
 * Orchestration entry point: turns a natural-language intent into a **verified** CZML document.
 * Pipeline: domain matching -> prompt building -> model call (via the AI SDK's `generateText`
 * with an `Output.object()` setting, for structured output) -> verify (via `verifyCzml`: zod + a
 * real `CzmlDataSource` parse) -> retry-with-feedback. CZML is declarative data, not code, so
 * there is nothing to statically analyze for unsafe operations, only structural/semantic validity
 * to check.
 *
 * Model-agnostic by design: this function receives an already-resolved `LanguageModel` from the
 * caller and never selects a provider or reads API keys itself.
 */
import { generateText, Output, type LanguageModel } from "ai";
import {
  noopCodegenMetrics,
  noopLogger,
  type CodegenMetrics,
  type Logger,
} from "@cesium-ai/observability";
import { z } from "zod";
import { buildCzmlPrompt } from "./prompt-builder.js";
import { verifyCzml, czmlPacketShape } from "./czml-verifier.js";
import {
  matchBestSkills,
  matchSkillsForIntent,
  DEFAULT_SKILL_MATCH_THRESHOLD,
  type DomainMatch,
} from "./domain-matcher.js";
import type { CzmlSkill } from "./skills-loader.js";
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_SKILL_MATCH_LIMIT } from "./constants.js";

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
  /** Max number of matched feature-domain skills to inline as extra grounding context in the generation prompt. Defaults to {@link DEFAULT_SKILL_MATCH_LIMIT}. */
  maxSkills?: number;
  /** Minimum BM25 score a skill must reach to be considered a match. Defaults to {@link DEFAULT_SKILL_MATCH_THRESHOLD}. Set to 0 to disable filtering. */
  threshold?: number;
  /** Optional extra instructions appended to the generation prompt's output rules. */
  extraInstructions?: string;
  /** Structured logger for generation attempts/failures. Defaults to a no-op (silent) logger. */
  logger?: Logger;
  /** Metrics sink for token usage, skill-match scores, and generation duration. Defaults to a no-op. */
  metrics?: CodegenMetrics;
}

export type GenerateVerifiedCzmlResult =
  | { verified: true; czml: Record<string, unknown>[]; description: string; entityCount: number }
  | { verified: false; error: string; violations?: string[] };

/**
 * Scores and selects the feature-domain skills to inline as extra grounding context for `intent`,
 * logging the scoring breakdown and recording per-skill match metrics along the way.
 */
function selectSkillsForIntent(
  intent: string,
  maxSkills: number,
  threshold: number,
  logger: Logger,
  metrics: CodegenMetrics,
): CzmlSkill[] {
  const skillsWithScores = matchSkillsForIntent(intent);

  if (skillsWithScores.length > 0) {
    logger.debug("Scored skills for intent", {
      intent,
      threshold,
      totalScored: skillsWithScores.length,
      passedThreshold: skillsWithScores.filter((m) => m.score >= threshold).length,
      topSkill: skillsWithScores[0].skill.name,
      topScore: skillsWithScores[0].score,
    });
  }

  const bestSkills = matchBestSkills(intent, maxSkills, threshold);

  if (bestSkills.length === 0) {
    logger.debug("No feature-domain skill matched intent; generating with core reference only", {
      intent,
    });
  } else {
    logger.debug("Matched skills for intent", {
      intent,
      skillNames: bestSkills.map((s) => s.name),
    });
  }

  skillsWithScores.forEach((match: DomainMatch, rank) => {
    metrics.recordSkillMatchScore(match.score, {
      skill: match.skill.name,
      rank,
      passedThreshold: match.score >= threshold,
      includedInBestSkills: bestSkills.some((s) => s.name === match.skill.name),
    });
  });

  return bestSkills;
}

/** Appends the previous attempt's verification failures to `basePrompt` as correction feedback. */
function buildCorrectionPrompt(basePrompt: string, violations: string[]): string {
  return `${basePrompt}

Your previous attempt was rejected by verification for the following reason(s):
${violations.map((v) => `- ${v}`).join("\n")}

Generate a corrected CZML document that avoids all of the above issues, still following all output rules above.`;
}

/** One model call for one generation attempt; records token usage and lets callers handle errors. */
async function generateCzmlAttempt(
  model: LanguageModel,
  prompt: string,
  attempt: number,
  metrics: CodegenMetrics,
): Promise<{ czml: Record<string, unknown>[]; description: string }> {
  const result = await generateText({
    model,
    prompt,
    output: Output.object({ schema: czmlGenerationObjectShape }),
    // CZML packets are deliberately loosely-typed (`z.record`, see czml-verifier.ts) since
    // real CZML properties vary per packet — that produces a `propertyNames` keyword in the
    // JSON schema, which OpenAI's *strict* structured-output mode rejects
    // ("'propertyNames' is not permitted"). Other providers ignore unknown providerOptions
    // keys, so this only affects OpenAI.
    providerOptions: { openai: { strictJsonSchema: false } },
  });

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

  return result.output;
}

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
  const maxSkills = options.maxSkills ?? DEFAULT_SKILL_MATCH_LIMIT;
  const threshold = options.threshold ?? DEFAULT_SKILL_MATCH_THRESHOLD;
  const logger = options.logger ?? noopLogger;
  const metrics = options.metrics ?? noopCodegenMetrics;

  logger.debug("Generating CZML", { intent, maxAttempts, maxSkills });

  const bestSkills = selectSkillsForIntent(intent, maxSkills, threshold, logger, metrics);
  const basePrompt = buildCzmlPrompt({ intent, skills: bestSkills, extraInstructions });

  let lastViolations: string[] | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = lastViolations ? buildCorrectionPrompt(basePrompt, lastViolations) : basePrompt;
    const attemptStart = Date.now();

    let generated: { czml: Record<string, unknown>[]; description: string };
    try {
      generated = await generateCzmlAttempt(model, prompt, attempt, metrics);
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
