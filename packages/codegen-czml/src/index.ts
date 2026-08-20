/**
 * @cesium-ai/codegen-czml — intent -> verified CZML generation pipeline, plus the
 * `generateCzml` tool definition that fronts it. Model-agnostic generation grounded in an
 * inlined CZML reference, plus semantic verification via Cesium's own `CzmlDataSource` parser
 * (parse-only, never renders anything), live here, alongside the schema-only `generateCzml`
 * tool (see `./tools/generateCzml/generateCzml.ts`) — the natural-language-intent tool that
 * needs this generation pipeline rather than a live `Viewer`, unlike the tools in
 * `@cesium-ai/tools-schemas` (reserved for viewer-specific tools like `flyTo`).
 */
export { noopCodegenLogger, type CodegenLogger } from "./logger.js";
export { noopCodegenMetrics, type CodegenMetrics, type CodegenTokenUsage } from "./metrics.js";
export { CZML_REFERENCE } from "./pipeline/czml-reference.js";
export { loadCzmlSkills, type CzmlSkill } from "./pipeline/skills-loader.js";
export { createLoadSkillTool, type OnSkillLoaded } from "./pipeline/skill-tool.js";
export { buildCzmlPrompt, type BuildPromptOptions } from "./pipeline/prompt-builder.js";
export {
  verifyCzml,
  czmlPacketShape,
  czmlDocumentShape,
  type VerifyCzmlOptions,
  type VerifyCzmlResult,
} from "./pipeline/czml-verifier.js";
export {
  generateVerifiedCzml,
  type GenerateVerifiedCzmlOptions,
  type GenerateVerifiedCzmlResult,
} from "./pipeline/generate-verified-czml.js";

export { CODEGEN_CZML_TOOL_NAMES, type CodegenCzmlToolName } from "./tool-names.js";
export { generateCzmlInputShape, type GenerateCzmlInput } from "./schemas.js";
export {
  createGenerateCzml,
  generateCzml,
  type GenerateCzmlConfig,
  DEFAULT_GENERATE_CZML_DESCRIPTION,
  DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS,
  buildGenerateCzmlInputSchema,
  defaultGenerateCzmlInputSchema,
  type GenerateCzmlFieldDescriptions,
} from "./tools/generateCzml/generateCzml.js";
export { buildDescribedSchema, describeShape } from "./lib/describe-shape.js";
export { mergeDescriptions } from "./lib/merge-descriptions.js";
