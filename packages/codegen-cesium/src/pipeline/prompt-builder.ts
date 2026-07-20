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
- Always \`await\` Promise-returning CesiumJS APIs (especially factories whose names end in \`Async\`, such as \`Cesium.createOsmBuildingsAsync()\`) before passing their resolved values to another API. Never pass a Promise directly to a collection's \`.add(...)\` method or use it as a Cesium object.
- The execution VM is disposed when the snippet completes, so callbacks cannot outlive it. Never use \`setTimeout\`, \`setInterval\`, \`requestAnimationFrame\`, event-listener callbacks, or completion callbacks to implement persistent animation or interaction; these timer globals are unavailable and rejected by verification. Only perform effects that complete within the top-level snippet using documented Promise-returning APIs and \`await\`.
- This VM-disposal limitation also rules out \`Cesium.CallbackProperty\`/\`Cesium.CallbackPositionProperty\` (and any other CesiumJS API whose argument is a function CesiumJS calls later, on its own, after your snippet has already returned) — passing a function into ANY CesiumJS API is rejected at runtime, even though it isn't an event listener or a timer. For dynamic/time-varying values, use a documented pre-computed property type instead: \`Cesium.SampledProperty\`/\`Cesium.SampledPositionProperty\` (add concrete samples via \`.addSample(time, value)\` for known times) or \`Cesium.TimeIntervalCollectionProperty\` (add concrete \`Cesium.TimeInterval\`s with fixed values), whichever the reference material shows. If the intent truly needs a value computed from something only known at render time, pick a fixed/static value instead and state that limitation is why in a one-line comment rather than using a callback.
- In a \`Cesium3DTileStyle\` style expression (e.g. \`Cesium.Cesium3DTileStyle\`'s \`color\`/\`show\` conditions), a feature property that a tile doesn't have (e.g. \`\${feature['height']}\`) evaluates to \`undefined\`, NOT \`null\` — guarding a numeric comparison with \`!== null\` does NOT protect it (\`undefined !== null\` is \`true\`, so the comparison still runs and throws "Operator ... requires number arguments"). Guard with \`!== undefined\` instead (or check both), and always list the guard clause before the numeric comparison in the same \`&&\` condition.
- Any Scene picking method (\`scene.pick\`, \`scene.drillPick\`, \`scene.pickPosition\`, \`scene.pickVoxel\`, \`scene.pickAsync\`) can return \`undefined\` if nothing is at the given screen position — NEVER access a property or call a method on its return value without first guarding with \`Cesium.defined(result)\` (and, if you need a specific type such as a 3D Tiles feature, also an \`instanceof\` check, e.g. \`result instanceof Cesium.Cesium3DTileFeature\`), exactly as the reference material's own examples always do. This also applies to a synchronous pick performed at the top level of your snippet (not just inside an event handler) — content just added in the same snippet may not have rendered a frame yet at that screen position, so the pick can legitimately come back \`undefined\` even when the content exists.
- \`viewer.camera.lookAt(target, offset)\` and \`viewer.camera.lookAtTransform(transform, offset)\` are NOT interchangeable — never pass one method's first argument to the other. \`lookAt\`'s first argument must be a \`Cesium.Cartesian3\` world position (e.g. \`Cesium.Cartesian3.fromDegrees(...)\`); \`lookAtTransform\`'s first argument must be a \`Cesium.Matrix4\` reference frame (e.g. the return value of \`Cesium.Transforms.eastNorthUpToFixedFrame(...)\`). Passing a \`Matrix4\` transform into \`lookAt\` (or a \`Cartesian3\` into \`lookAtTransform\`) throws a runtime error (e.g. "origin has a NaN component") because the wrong-shaped value is read as if it had \`x\`/\`y\`/\`z\` components. If you've already computed an east-north-up transform via \`Transforms.eastNorthUpToFixedFrame\`, call \`lookAtTransform\` with it directly — do not also call \`lookAt\`.
- Never use computed/bracket member access (e.g. \`someArray[i]\`, \`coordinates[index]\`, \`obj["prop"]\`) anywhere in your output — it is rejected outright by static verification, even for plain array indexing. When you need to iterate over an array (e.g. per-vertex coordinates, a list of positions) and act on each element, use \`array.forEach((element) => { ... })\` or \`for (const element of array)\` so you bind the element directly instead of indexing into the array. Plain non-computed property/method access (\`viewer.entities\`, \`entity.position\`) is dot notation, not computed access, and remains fully allowed.
- When you need a single specific element of an array by position instead of iterating (e.g. "the most recently created entity", "the first coordinate"), never write \`array[array.length - 1]\`, \`array[0]\`, or any other bracket index — use \`array.at(-1)\` for the last element, \`array.at(0)\` for the first, or \`array.at(n)\` for any other index. \`.at(...)\` is a plain (non-computed) method call, not member access, so it is fully allowed and is the correct replacement for indexed array access in every case.
- \`document\`, \`window\`, \`Image\`, and any other DOM/canvas API are never available in the code execution environment, even though your snippet ultimately runs in a browser — never call \`document.createElement("canvas")\` or similar to draw your own texture (e.g. for a \`ParticleSystem\`'s \`image\` option). If you need an ad-hoc image/canvas and the intent doesn't supply a concrete image URL, use \`new Cesium.PinBuilder().fromColor(Cesium.Color.<NAME>, size)\` — it synchronously returns a real canvas you can pass directly as the image.
- If the intent cannot be accomplished with the documented APIs, or requires a concrete external asset URL/ID that isn't supplied by the intent or reference material, output a single-line JavaScript comment explaining why, instead of guessing at an API or inventing an asset path.${
    extraInstructions?.trim()
      ? `\n\nAdditional instructions from the host application:\n${extraInstructions.trim()}`
      : ""
  }`;
}
