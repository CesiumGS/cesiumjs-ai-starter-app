/**
 * Orchestration entry point: turns a natural-language intent into a **verified** CesiumJS code
 * snippet. This is the single public pipeline function most callers want — it wires together
 * domain matching, prompt building, model-agnostic generation, and AST-based static verification,
 * retrying generation (with the verifier's violations fed back to the model) a bounded number of
 * times before giving up.
 *
 * Model-agnostic by design, exactly like `@cesium-ai/server`'s `runAgent`: this function receives
 * an already-resolved `LanguageModel` from the caller and never selects a provider or reads API
 * keys itself. Provider/API-key selection is the host application's job.
 *
 * This module NEVER executes the generated code. `verifyCesiumCode` is parse-only static analysis.
 */
import { generateText, type LanguageModel } from "ai";
import { matchBestSkill } from "./domain-matcher.js";
import { buildCodegenPrompt } from "./prompt-builder.js";
import { verifyCesiumCode } from "./ast-verifier.js";

export interface GenerateVerifiedCesiumCodeOptions {
  /** The user's natural-language intent, e.g. "fly the camera to Paris". */
  intent: string;
  /** The resolved language model to generate with (see {@link LanguageModel}). */
  model: LanguageModel;
  /** Max regeneration attempts if a generation fails verification. Default 3. */
  maxAttempts?: number;
  /** Max number of matched skills to inline as grounding context in the generation prompt. Controlled by `CODEGEN_MAX_SKILLS` env var in the sample app (default `1`). */
  maxSkills?: number;
}

export type GenerateVerifiedCesiumCodeResult =
  { verified: true; code: string } | { verified: false; error: string; violations?: string[] };

const DEFAULT_MAX_ATTEMPTS = 3;

/** Strips a leading/trailing ```-fenced code block, if the model wrapped its output in one. */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /^```(?:\w+)?\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Generates a CesiumJS code snippet for `intent` and verifies it via static AST analysis before
 * returning it. Retries generation (feeding the previous attempt's violations back to the model
 * as extra prompt context) up to `maxAttempts` total attempts. Never returns unverified code as if
 * it were verified, and never executes generated code at any point.
 */
export async function generateVerifiedCesiumCode(
  options: GenerateVerifiedCesiumCodeOptions,
): Promise<GenerateVerifiedCesiumCodeResult> {
  const { intent, model, maxSkills } = options;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // Retrieve top candidate skills to provide grounding context for code generation.
  const skills = matchBestSkill(intent);

  const basePrompt = buildCodegenPrompt({ intent, skills, maxSkills });

  const correctionPrompt = (basePromptStr: string, violations: string[]) =>
    `${basePromptStr}

Your previous attempt was rejected by static verification for the following reason(s):
${violations.map((v) => `- ${v}`).join("\n")}

Generate a corrected code snippet that avoids all of the above issues, still following all output rules above.`;

  let lastViolations: string[] | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt =
      attempt === 1 || !lastViolations ? basePrompt : correctionPrompt(basePrompt, lastViolations);

    let rawCode: string;
    try {
      const result = await generateText({ model, prompt });
      rawCode = result.text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      continue;
    }

    const code = stripCodeFences(rawCode);
    const verifyResult = verifyCesiumCode(code);

    if (verifyResult.verified) {
      return { verified: true, code };
    }

    lastViolations = verifyResult.violations;
  }

  return {
    verified: false,
    error: lastError ?? "Generated code failed static AST verification after all attempts.",
    ...(lastViolations ? { violations: lastViolations } : {}),
  };
}
