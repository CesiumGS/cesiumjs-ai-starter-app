/**
 * Canonical tool identifier(s) for `@cesium-ai/codegen-cesium`'s codegen tool
 * surface — the **single source of truth** shared by the server tool registry
 * and the client-side result handler.
 *
 * This module imports nothing (no `ai`, no `zod`) on purpose: the frontend
 * imports it to compare against streamed tool-call names, so it must stay free
 * of tool *definitions* to keep schemas out of the client bundle. Names alone
 * are not sensitive — they already appear in the tool-call payloads streamed
 * to the browser.
 *
 * Mirrors `@cesium-ai/tools-schemas`'s identical `tool-names.ts` pattern, kept
 * as a separate module (and package) because `executeCesiumCode` is not a
 * viewer-specific tool — unlike `flyTo`, it needs the codegen + AST
 * verification pipeline this package owns, not a live `Viewer` handed
 * arguments directly.
 */
export const CODEGEN_CESIUM_TOOL_NAMES = {
  executeCesiumCode: "executeCesiumCode",
} as const;

/** Union of every codegen-cesium tool name. */
export type CodegenCesiumToolName =
  (typeof CODEGEN_CESIUM_TOOL_NAMES)[keyof typeof CODEGEN_CESIUM_TOOL_NAMES];
