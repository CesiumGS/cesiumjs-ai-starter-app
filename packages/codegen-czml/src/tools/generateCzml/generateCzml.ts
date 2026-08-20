import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { generateCzmlInputShape } from "./generateCzml.schema.js";

/**
 * Default natural-language description handed to the model for `generateCzml`. Exported so
 * hosts can extend it (e.g. append app-specific guidance) rather than rewrite it from scratch.
 */
export const DEFAULT_GENERATE_CZML_DESCRIPTION =
  "Create a time-dynamic scene on the 3D globe — a satellite orbit, a flight path, an animated " +
  "tour, several markers appearing over time, and similar — by describing your intent in " +
  "natural language, do NOT write CZML yourself. The intent you provide is turned into a " +
  "verified CZML (Cesium Language) document and loaded in the frontend. Use this to complement " +
  "`entityAdd`/`flyTo` for requests that need interpolated motion over time or should populate " +
  "the timeline; use `entityAdd` instead for a single static entity. IMPORTANT: a result " +
  "containing `czml` only means the generated document passed verification — it does NOT " +
  "confirm the scene actually loaded successfully in the browser yet. Do not tell the user the " +
  "scene is ready until that is the only result you have seen for this request; if a later " +
  "result for the same request instead contains `error`, the load failed — tell the user " +
  "honestly that it failed and why, do not describe it as having succeeded.";

/** Per-field model-facing `.describe()` hints for the `generateCzml` input schema. */
export interface GenerateCzmlFieldDescriptions {
  intent?: string;
}

/**
 * Default **model-facing** `.describe()` hint for each `generateCzml` input field. Exported so
 * hosts can read or extend an individual hint rather than rewrite the whole schema. Override a
 * subset via {@link GenerateCzmlConfig.fieldDescriptions} or {@link buildGenerateCzmlInputSchema}.
 */
export const DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS: Required<GenerateCzmlFieldDescriptions> = {
  intent:
    "Natural-language description of the time-dynamic scene to create (not CZML). Be specific " +
    "about the entities, motion/timing, and duration desired.",
};

/**
 * Builds the **model-facing** `generateCzml` input schema: the shared structural shape
 * ({@link generateCzmlInputShape}) decorated with the natural-language `.describe()` hint the
 * LLM reads. The structural rule (non-empty intent string) lives once in
 * `generateCzml.schema.ts` and is shared with the client-side validator; only the model-facing
 * hint is added here, server-side.
 */
export function buildGenerateCzmlInputSchema(descriptions: GenerateCzmlFieldDescriptions = {}) {
  return buildDescribedSchema(
    generateCzmlInputShape.shape,
    DEFAULT_GENERATE_CZML_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `generateCzml` input schema, using every default field hint. */
export const defaultGenerateCzmlInputSchema = buildGenerateCzmlInputSchema();

/** Per-tool overrides for {@link createGenerateCzml}. */
export type GenerateCzmlConfig = ClientToolConfig<GenerateCzmlFieldDescriptions>;

/**
 * `generateCzml` — describes a time-dynamic globe scene by intent, turned into a verified CZML
 * document by this package's generation pipeline.
 *
 * Unlike `@cesium-ai/tools-schemas`'s viewer tools (e.g. `flyTo`), this tool's intent can't just
 * be validated and handed to the live `Viewer` client-side — turning natural language into a
 * safe, semantically-valid CZML document needs a generation + verification step first (see
 * `generate-verified-czml.ts`'s `generateVerifiedCzml`). That's why this tool lives in
 * `@cesium-ai/codegen-czml` rather than `@cesium-ai/tools-schemas`.
 *
 * Rather than give this library tool an `execute` that would force every consumer to resolve a
 * model at import time, this tool stays **schema-only by design** — the same pattern
 * `@cesium-ai/codegen-cesium`'s `executeCesiumCode` follows. A host application builds its own
 * executable version by wrapping `generateVerifiedCzml` around this schema, the way this repo's
 * sample app does in `backend/src/tools/generate-czml-tool.ts` (`createGenerateCzmlTool`).
 *
 * Pass {@link GenerateCzmlConfig} to tune the description, the field hint, or the whole input
 * schema for a host application without forking the tool.
 */
export const createGenerateCzml = createToolFactory(
  DEFAULT_GENERATE_CZML_DESCRIPTION,
  buildGenerateCzmlInputSchema,
);

/** Ready-to-use `generateCzml` tool with default description and schema. */
export const generateCzml = createGenerateCzml();
