import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { flyToInputShape } from "./flyTo.schema.js";

/**
 * Default natural-language description handed to the model for `flyTo`. Exported
 * so hosts can extend it (e.g. append app-specific guidance) rather than rewrite
 * it from scratch.
 */
export const DEFAULT_FLY_TO_DESCRIPTION =
  "Fly the 3D globe camera to a geographic location, given as latitude/longitude " +
  "(and optional altitude in metres). Resolve the place the user names — a city, " +
  "country, landmark, or address — to its coordinates yourself. Use this whenever " +
  "the user asks to go to, show, or look at a location.";

/** Per-field model-facing `.describe()` hints for the `flyTo` input schema. */
export interface FlyToFieldDescriptions {
  latitude?: string;
  longitude?: string;
  altitude?: string;
}

/**
 * Default **model-facing** `.describe()` hint for each `flyTo` input field.
 * Exported so hosts can read or extend an individual hint (e.g. append
 * app-specific guidance) rather than rewrite the whole schema. Override a subset
 * via {@link FlyToConfig.fieldDescriptions} or {@link buildFlyToInputSchema}.
 */
export const DEFAULT_FLY_TO_FIELD_DESCRIPTIONS: Required<FlyToFieldDescriptions> = {
  latitude: "Latitude of the destination in decimal degrees (-90 to 90).",
  longitude: "Longitude of the destination in decimal degrees (-180 to 180).",
  altitude: "Camera height above the ellipsoid, in metres. Omit for a sensible default.",
};

/**
 * Builds the **model-facing** `flyTo` input schema: the shared structural shape
 * ({@link flyToInputShape}) decorated with the natural-language `.describe()`
 * hints the LLM reads. The structural rules (lat/lon ranges, optional altitude)
 * live once in `flyTo.schema.ts` and are shared with the client-side executor;
 * only the model-facing hints are added here, server-side.
 *
 * Pass a subset of {@link FlyToFieldDescriptions} to override individual hints;
 * any field left out (or set to `undefined`) keeps its
 * {@link DEFAULT_FLY_TO_FIELD_DESCRIPTIONS default}.
 */
export function buildFlyToInputSchema(descriptions: FlyToFieldDescriptions = {}) {
  return buildDescribedSchema(
    flyToInputShape.shape,
    DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `flyTo` input schema, using every default field hint. */
export const defaultFlyToInputSchema = buildFlyToInputSchema();

/** Per-tool overrides for {@link createFlyTo}. */
export type FlyToConfig = ClientToolConfig<FlyToFieldDescriptions>;

/**
 * `flyTo` — moves the CesiumJS camera to a named location.
 *
 * This is a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back. Keeping
 * execution on the client means the server never needs a geocoder and the
 * camera animation happens where the globe actually lives.
 *
 * Pass {@link FlyToConfig} to tune the description, individual field hints, or
 * the whole input schema for a host application without forking the tool.
 */
export const createFlyTo = createToolFactory(DEFAULT_FLY_TO_DESCRIPTION, buildFlyToInputSchema);

/** Ready-to-use `flyTo` tool with default description and schema. */
export const flyTo = createFlyTo();
