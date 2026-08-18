/**
 * Canonical tool identifier(s) for `@cesium-ai/codegen-czml`'s codegen tool surface — the
 * **single source of truth** shared by the server tool registry and the client-side result
 * handler.
 *
 * This module imports nothing (no `ai`, no `zod`) on purpose: the frontend imports it to
 * compare against streamed tool-call names, so it must stay free of tool *definitions* to keep
 * schemas out of the client bundle. Names alone are not sensitive — they already appear in the
 * tool-call payloads streamed to the browser.
 *
 * Mirrors `@cesium-ai/codegen-cesium`'s identical `tool-names.ts` pattern, kept as a separate
 * module (and package) because `generateCzml` is not a viewer-specific tool — unlike `flyTo`, it
 * needs its own intent -> verified-CZML generation pipeline, not a live `Viewer` handed
 * arguments directly.
 */
export const CODEGEN_CZML_TOOL_NAMES = {
  generateCzml: "generateCzml",
} as const;

/** Union of every codegen-czml tool name. */
export type CodegenCzmlToolName = (typeof CODEGEN_CZML_TOOL_NAMES)[keyof typeof CODEGEN_CZML_TOOL_NAMES];
