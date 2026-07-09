/**
 * Builds the grounded generation prompt sent to a model to produce a CesiumJS code snippet for a
 * given intent. Per the design, only the matched skill's snippet is injected as few-shot context
 * (not all vendored skills) — this keeps the prompt small and keeps the model's capability
 * surface scoped to what's actually relevant to the intent.
 */
import type { CesiumSkill } from "./skills-loader.js";

export interface BuildPromptOptions {
  /** The user's natural-language intent, e.g. "fly the camera to Paris". */
  intent: string;
  /** Matched skills, most relevant first (see {@link matchSkillsForIntent}). */
  skills: CesiumSkill[];
  /** Max number of skills to inline as grounding context. Defaults to 1. */
  maxSkills?: number;
}

const DEFAULT_MAX_SKILLS = 1;

/**
 * Builds a prompt that states the intent, includes the top-matched skill(s)' body content as
 * grounding, and instructs the model to output only a bare JavaScript code snippet using only the
 * documented capability surface — no invented APIs, no markdown fences, no explanation.
 */
export function buildCodegenPrompt({
  intent,
  skills,
  maxSkills = DEFAULT_MAX_SKILLS,
}: BuildPromptOptions): string {
  const groundingSkills = skills.slice(0, maxSkills);

  const groundingSections = groundingSkills
    .map((skill) => `### Reference: ${skill.name}\n\n${skill.body.trim()}`)
    .join("\n\n---\n\n");

  return `You are a CesiumJS code generator. Generate a JavaScript code snippet that accomplishes the user's intent below, using ONLY the CesiumJS APIs documented in the reference material that follows. Do not invent classes, methods, or properties that aren't shown in the reference material.

User intent: "${intent}"

${groundingSections || "(No matching reference material was found for this intent.)"}

Output rules:
- Output ONLY the JavaScript code snippet — no markdown code fences, no explanation, no comments about your process.
- Use only symbols, patterns, and usage shown in the reference material above.
- Assume CesiumJS is already imported/available and a \`viewer\` instance already exists unless the reference material says otherwise.
- If the intent cannot be accomplished with the documented APIs, output a single-line JavaScript comment explaining why, instead of guessing at an API.`;
}
