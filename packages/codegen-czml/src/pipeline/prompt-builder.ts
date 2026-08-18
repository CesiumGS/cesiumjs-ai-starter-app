/**
 * Builds the grounded generation prompt sent to a model to produce a CZML document for a given
 * intent. The whole {@link CZML_REFERENCE} is inlined every time (unlike
 * `@cesium-ai/codegen-cesium`'s per-intent skill matching) since CZML's packet schema is small
 * and fixed.
 */
import { CZML_REFERENCE } from "./czml-reference.js";

export interface BuildPromptOptions {
  /** The user's natural-language intent, e.g. "animate a satellite orbit over Europe for 24 hours". */
  intent: string;
  /**
   * Optional extra instructions appended to the end of the prompt's output rules, e.g.
   * app-specific constraints or house style preferences. Supplied by the host app/operator, never
   * end-user chat input — see `@cesium-ai/codegen-cesium`'s identical option for why.
   */
  extraInstructions?: string;
}

/**
 * Builds a prompt that states the intent, includes the CZML reference material as grounding, and
 * instructs the model to output a CZML document plus a short human-readable summary.
 */
export function buildCzmlPrompt({ intent, extraInstructions }: BuildPromptOptions): string {
  return `You are a CZML (Cesium Language) generator. Generate a CZML document that accomplishes the user's intent below, using ONLY the packet properties documented in the reference material that follows. Do not invent packet properties that aren't shown in the reference material.

User intent: "${intent}"

${CZML_REFERENCE}

Output rules:
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
