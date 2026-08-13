/**
 * @cesium-ai/codegen-cesium — intent -> verified CesiumJS code generation pipeline, plus the
 * `executeCesiumCode` tool definition that fronts it. Vendored CesiumJS Agent Skills grounding,
 * domain matching, model-agnostic generation, and AST-based static verification (parse-only,
 * never executes generated code) live here, alongside the schema-only `executeCesiumCode` tool
 * (see `./tools/executeCesiumCode/executeCesiumCode.ts`) — the natural-language-intent tool that
 * needs this codegen pipeline rather than a live `Viewer`, unlike the tools in
 * `@cesium-ai/tools-schemas` (reserved for viewer-specific tools like `flyTo`).
 */
export { noopCodegenLogger, type CodegenLogger } from "./logger.js";
export { noopCodegenMetrics, type CodegenMetrics, type CodegenTokenUsage } from "./metrics.js";
export { loadCesiumSkills, type CesiumSkill } from "./pipeline/skills-loader.js";
export {
  matchSkillsForIntent,
  matchBestSkills,
  DEFAULT_SKILL_MATCH_LIMIT,
  DEFAULT_SKILL_MATCH_THRESHOLD,
  type DomainMatch,
} from "./pipeline/domain-matcher.js";
export { buildCodegenPrompt, type BuildPromptOptions } from "./pipeline/prompt-builder.js";

export {
  verifyCesiumCode,
  SAFE_GLOBAL_IDENTIFIERS,
  type VerifyOptions,
  type VerifyResult,
} from "./pipeline/ast-verifier.js";
export {
  generateVerifiedCesiumCode,
  type GenerateVerifiedCesiumCodeOptions,
  type GenerateVerifiedCesiumCodeResult,
  type RuntimeCodegenFeedback,
} from "./pipeline/generate-verified-cesium-code.js";

export { CODEGEN_CESIUM_TOOL_NAMES, type CodegenCesiumToolName } from "./tool-names.js";
export { executeCesiumCodeInputShape, type ExecuteCesiumCodeInput } from "./schemas.js";
export {
  createExecuteCesiumCode,
  executeCesiumCode,
  type ExecuteCesiumCodeConfig,
  DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
  DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS,
  buildExecuteCesiumCodeInputSchema,
  defaultExecuteCesiumCodeInputSchema,
  type ExecuteCesiumCodeFieldDescriptions,
} from "./tools/executeCesiumCode/executeCesiumCode.js";
export { buildDescribedSchema, describeShape } from "./lib/describe-shape.js";
export { mergeDescriptions } from "./lib/merge-descriptions.js";
