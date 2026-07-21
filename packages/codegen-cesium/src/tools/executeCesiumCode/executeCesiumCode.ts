import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { executeCesiumCodeInputShape } from "./executeCesiumCode.schema.js";

/**
 * Default natural-language description handed to the model for
 * `executeCesiumCode`. Exported so hosts can extend it (e.g. append
 * app-specific guidance) rather than rewrite it from scratch.
 */
export const DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION =
  "Perform a more complex custom camera, entity, or scene manipulation on the 3D " +
  "globe by describing your intent in natural language — do NOT write code " +
  "yourself. The intent you provide is turned into verified CesiumJS code and run " +
  "in a sandboxed frontend context. Use this to complement `flyTo` for requests " +
  "that don't fit a simple fly-to-location call, e.g. drawing shapes, adding " +
  "entities, adjusting scene appearance, or animating the camera in ways beyond a " +
  "single fly-to.";

/** Per-field model-facing `.describe()` hints for the `executeCesiumCode` input schema. */
export interface ExecuteCesiumCodeFieldDescriptions {
  intent?: string;
}

/**
 * Default **model-facing** `.describe()` hint for each `executeCesiumCode` input
 * field. Exported so hosts can read or extend an individual hint (e.g. append
 * app-specific guidance) rather than rewrite the whole schema. Override a subset
 * via {@link ExecuteCesiumCodeConfig.fieldDescriptions} or
 * {@link buildExecuteCesiumCodeInputSchema}.
 */
export const DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS: Required<ExecuteCesiumCodeFieldDescriptions> =
  {
    intent:
      "Natural-language description of what should happen on the globe (not code). " +
      "Be specific about the camera, entities, or scene changes desired.",
  };

/**
 * Builds the **model-facing** `executeCesiumCode` input schema: the shared
 * structural shape ({@link executeCesiumCodeInputShape}) decorated with the
 * natural-language `.describe()` hints the LLM reads. The structural rules
 * (non-empty intent string) live once in `executeCesiumCode.schema.ts` and are
 * shared with the client-side validator; only the model-facing hints are added
 * here, server-side.
 *
 * Pass a subset of {@link ExecuteCesiumCodeFieldDescriptions} to override
 * individual hints; any field left out (or set to `undefined`) keeps its
 * {@link DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS default}.
 */
export function buildExecuteCesiumCodeInputSchema(
  descriptions: ExecuteCesiumCodeFieldDescriptions = {},
) {
  return buildDescribedSchema(
    executeCesiumCodeInputShape.shape,
    DEFAULT_EXECUTE_CESIUM_CODE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `executeCesiumCode` input schema, using every default field hint. */
export const defaultExecuteCesiumCodeInputSchema = buildExecuteCesiumCodeInputSchema();

/** Per-tool overrides for {@link createExecuteCesiumCode}. */
export type ExecuteCesiumCodeConfig = ClientToolConfig<ExecuteCesiumCodeFieldDescriptions>;

/**
 * `executeCesiumCode` — describes a more complex custom camera/entity/scene
 * manipulation by intent, for cases that don't fit `@cesium-ai/tools-schemas`'s
 * `flyTo` simple fly-to-location shape.
 *
 * Unlike `flyTo`, this tool's intent can't just be validated and handed to the
 * live `Viewer` client-side — turning natural language into safe CesiumJS code
 * needs a codegen + static-verification step first
 * ({@link file://./../../pipeline/generate-verified-cesium-code.ts}'s
 * `generateVerifiedCesiumCode`). That's why this tool lives in
 * `@cesium-ai/codegen-cesium` rather than `@cesium-ai/tools-schemas`: the
 * latter is reserved for tools that run directly against a live CesiumJS
 * `Viewer`, while this one needs the codegen pipeline this package owns.
 * Rather than give this library tool an `execute` that would force every
 * consumer to resolve a model at import time, this tool stays **schema-only
 * by design** — the same "app builds its own extended tool on top of the
 * shared schema" pattern `@cesium-ai/tools-schemas`'s `flyTo` follows via
 * `backend/src/tools/flyto-tool.ts`.
 *
 * A host application that wants `executeCesiumCode` to actually do something
 * builds its own executable version by wrapping `generateVerifiedCesiumCode`
 * around this schema, the way this repo's sample app does in
 * `backend/src/tools/execute-cesium-code-tool.ts` (`createExecuteCesiumCodeTool`)
 * — that app imports this schema-only tool's description/input schema and
 * layers a real server-side `execute` on top, merging the result into its
 * tool registry alongside `@cesium-ai/tools-schemas`'s viewer tools. See that
 * file, and this package's README, for the real end-to-end pipeline.
 *
 * Pass {@link ExecuteCesiumCodeConfig} to tune the description, individual field
 * hints, or the whole input schema for a host application without forking the
 * tool.
 */
export const createExecuteCesiumCode = createToolFactory(
  DEFAULT_EXECUTE_CESIUM_CODE_DESCRIPTION,
  buildExecuteCesiumCodeInputSchema,
);

/** Ready-to-use `executeCesiumCode` tool with default description and schema. */
export const executeCesiumCode = createExecuteCesiumCode();
