/**
 * Defines the `loadSkill` tool that lets the CZML-generating model dynamically pull in a named
 * feature-domain skill's full reference material mid-generation, instead of the harness
 * pre-selecting skills via keyword scoring (the previous BM25 approach in `domain-matcher.ts`,
 * removed). The model is shown only each skill's name/description upfront (see
 * `prompt-builder.ts`'s catalog section) and decides for itself which, if any, to load in full —
 * mirrors Agent Skills' own progressive-disclosure design instead of a harness-computed top-N.
 */
import { tool, type Tool } from "ai";
import { z } from "zod";
import type { CzmlSkill } from "./skills-loader.js";

/** Optional hook invoked whenever the model successfully loads a known skill. */
export type OnSkillLoaded = (skillName: string) => void;

/**
 * Builds the `loadSkill` tool bound to a fixed skill catalog for one generation call. Looking up
 * an unknown name returns an error string (not a thrown error) so the model can see the mistake
 * and retry with a valid name instead of the tool call/generation attempt failing outright.
 */
export function createLoadSkillTool(skills: CzmlSkill[], onSkillLoaded?: OnSkillLoaded): Tool {
  return tool({
    description:
      "Load the full reference material for a named CZML feature-domain skill (see the skill catalog in the prompt for available names and descriptions). Call this before using any packet property not already covered by the core reference material.",
    inputSchema: z.object({
      name: z.string().describe('The exact skill name from the catalog, e.g. "czml-polyline".'),
    }),
    execute: async ({ name }) => {
      const skill = skills.find((s) => s.name === name);
      if (!skill) {
        return `No skill named "${name}" found. Available skills: ${skills.map((s) => s.name).join(", ")}.`;
      }
      onSkillLoaded?.(name);
      return skill.body;
    },
  });
}
