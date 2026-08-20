/**
 * Builds the grounded generation prompt sent to a model to produce a CZML document for a given
 * intent. The core envelope (`CZML_REFERENCE` — document packet, "position", "point",
 * "availability") is always inlined; feature-specific reference material (billboard/label,
 * polyline, polygon, orientation, document clock, viewFrom, time-dynamic motion) is NOT inlined
 * upfront — only each skill's name/description is listed via `availableSkills`, and the model
 * dynamically pulls in a skill's full body mid-generation via the `loadSkill` tool (see
 * `skill-tool.ts`) if and when it decides the intent needs it. Replaces the previous
 * harness-computed BM25 top-N match (`domain-matcher.ts`, removed).
 */
import { CZML_REFERENCE } from "./czml-reference.js";
import type { CzmlSkill } from "./skills-loader.js";

export interface BuildPromptOptions {
  /** The user's natural-language intent, e.g. "animate a satellite orbit over Europe for 24 hours". */
  intent: string;
  /**
   * The catalog of feature-domain skills the model may load via the `loadSkill` tool, listed as
   * name/description only (never the full body). Defaults to none — the core `CZML_REFERENCE`
   * alone still covers a static point/position, so an empty catalog isn't a broken prompt, just a
   * less-grounded one.
   */
  availableSkills?: Pick<CzmlSkill, "name" | "description">[];
  /**
   * Optional extra instructions appended to the end of the prompt's output rules, e.g.
   * app-specific constraints or house style preferences. Supplied by the host app/operator, never
   * end-user chat input — see `@cesium-ai/codegen-cesium`'s identical option for why.
   */
  extraInstructions?: string;
}

/**
 * Builds a prompt that states the intent, includes the CZML core reference plus a catalog of
 * feature-domain skills loadable on demand via the `loadSkill` tool, and instructs the model to
 * output a CZML document plus a short human-readable summary.
 */
export function buildCzmlPrompt({
  intent,
  availableSkills = [],
  extraInstructions,
}: BuildPromptOptions): string {
  const skillsSection =
    availableSkills.length > 0
      ? `\n\nAdditional feature-domain reference material is available on demand via the "loadSkill" tool. Call it with one of these exact names whenever the intent needs a feature not already covered by the core reference above:\n${availableSkills.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n")}`
      : "";

  return `You are a CZML (Cesium Language) generator. Generate a CZML document that accomplishes the user's intent below, using ONLY the packet properties documented in the reference material that follows. Do not invent packet properties that aren't shown in the reference material.

User intent: "${intent}"

${CZML_REFERENCE}${skillsSection}

Output rules:
- If the intent needs a feature listed in the catalog above, call "loadSkill" for it BEFORE producing your final output — never guess at properties for a feature you haven't loaded reference material for.
- Return the "czml" packet array and a short "description" summarizing the scene, per the response schema.
- The first packet in "czml" MUST be the document packet ({ "id": "document", "version": "1.0", ... }).
- Every other packet MUST have a unique, non-"document" "id".
- Compute any interpolated positions (e.g. "cartographicDegrees" samples over an "epoch") yourself from the intent — never leave placeholder values.
- Use only property names and structures shown in the reference material above. Do not add extra packet properties beyond what's directly needed for the intent.
- Do not reference external image/model URLs unless the intent explicitly supplies one; prefer "point"/"path"/"polyline"/"label" styling, which need no external asset.${
    extraInstructions?.trim()
      ? `\n\nAdditional instructions from the host application:\n${extraInstructions.trim()}`
      : ""
  }`;
}
