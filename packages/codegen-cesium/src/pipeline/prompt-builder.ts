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
  /**
   * Optional extra instructions appended to the end of the prompt's output rules, e.g. app-specific
   * constraints ("this app's Viewer has no timeline/animation widgets") or house style preferences.
   * Supplied by the host app/operator (via `generateVerifiedCesiumCode`'s own `extraInstructions`
   * option, in turn from `CODEGEN_EXTRA_INSTRUCTIONS` in the sample backend) — never end-user
   * chat input, to avoid injecting untrusted text into this second, code-generating model call.
   */
  extraInstructions?: string;
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
  extraInstructions,
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
- Use only symbols, patterns, and usage shown in the reference material above. Do not add extra logic (e.g. checking whether something already exists, retry/guard patterns) beyond what's directly needed for the intent unless that pattern is shown in the reference material.
- Assume a \`viewer\` instance already exists. Do NOT write \`import\` statements: your snippet runs inside a plain function whose only in-scope names are \`viewer\` and a \`Cesium\` object holding every CesiumJS export.
- Access every CesiumJS class, function, and enum through that \`Cesium\` object (e.g. \`Cesium.Cartesian3.fromDegrees(...)\`, \`Cesium.Cesium3DTileset.fromIonAssetId(...)\`) — even when the reference material above shows it imported and used as a bare name (e.g. \`import { Cartesian3 } from "cesium"\` then \`Cartesian3.fromDegrees(...)\`). That import is not part of your output and none of those names exist as bare globals at runtime; every one of them must be prefixed with \`Cesium.\`.
- CesiumJS collection types (e.g. \`viewer.scene.primitives\`, a \`PrimitiveCollection\`; \`viewer.imageryLayers\`, an \`ImageryLayerCollection\`; \`viewer.dataSources\`, a \`DataSourceCollection\`) are NOT plain JavaScript arrays or iterables — never use \`for...of\`, spread (\`[...collection]\`), or \`Array.from(collection)\` on them. Use their own \`.length\` and \`.get(index)\` members instead, or a documented array-returning convenience shown in the reference material (e.g. \`viewer.entities.values\`, which IS a real array).
- The host Viewer's optional UI widgets (e.g. \`viewer.timeline\`, \`viewer.animation\`, \`viewer.baseLayerPicker\`, \`viewer.geocoder\`, \`viewer.fullscreenButton\`) may be disabled/undefined depending on how the host app constructed its \`Viewer\` — never assume one of these exists just because a reference example calls it. Only reference \`viewer.timeline\`/\`viewer.animation\` if the intent explicitly asks to interact with that widget. For controlling simulation time (e.g. bounds, playback speed, looping), set properties directly on \`viewer.clock\` (\`startTime\`, \`stopTime\`, \`currentTime\`, \`multiplier\`, \`shouldAnimate\`, \`clockRange\`) instead of calling methods on \`viewer.timeline\`.
- Any file path or URL for an external asset (a model, texture, GeoJSON file, etc.) shown in the reference material (e.g. \`"model.glb"\`, \`"path/to/model.glb"\`, \`"/data/counties.geojson"\`) is illustrative only, not a real network-reachable resource — never reuse a reference example's placeholder path verbatim as if it will resolve. Only use a concrete asset URL/ID if the user's intent explicitly supplies one (a URL, an Ion asset ID, or a named public sample asset called out by the reference material itself).
- In a \`Cesium3DTileStyle\` style expression (e.g. \`Cesium.Cesium3DTileStyle\`'s \`color\`/\`show\` conditions), a feature property that a tile doesn't have (e.g. \`\${feature['height']}\`) evaluates to \`undefined\`, NOT \`null\` — guarding a numeric comparison with \`!== null\` does NOT protect it (\`undefined !== null\` is \`true\`, so the comparison still runs and throws "Operator ... requires number arguments"). Guard with \`!== undefined\` instead (or check both), and always list the guard clause before the numeric comparison in the same \`&&\` condition.
- Never use computed/bracket member access (e.g. \`someArray[i]\`, \`coordinates[index]\`, \`obj["prop"]\`) anywhere in your output — it is rejected outright by static verification, even for plain array indexing. When you need to iterate over an array (e.g. per-vertex coordinates, a list of positions) and act on each element, use \`array.forEach((element) => { ... })\` or \`for (const element of array)\` so you bind the element directly instead of indexing into the array. Plain non-computed property/method access (\`viewer.entities\`, \`entity.position\`) is dot notation, not computed access, and remains fully allowed.
- \`document\`, \`window\`, \`Image\`, and any other DOM/canvas API are never available in the code execution environment, even though your snippet ultimately runs in a browser — never call \`document.createElement("canvas")\` or similar to draw your own texture (e.g. for a \`ParticleSystem\`'s \`image\` option). If you need an ad-hoc image/canvas and the intent doesn't supply a concrete image URL, use \`new Cesium.PinBuilder().fromColor(Cesium.Color.<NAME>, size)\` — it synchronously returns a real canvas you can pass directly as the image.
- If the intent cannot be accomplished with the documented APIs, or requires a concrete external asset URL/ID that isn't supplied by the intent or reference material, output a single-line JavaScript comment explaining why, instead of guessing at an API or inventing an asset path.${
    extraInstructions?.trim() ? `\n\nAdditional instructions from the host application:\n${extraInstructions.trim()}` : ""
  }`;
}
