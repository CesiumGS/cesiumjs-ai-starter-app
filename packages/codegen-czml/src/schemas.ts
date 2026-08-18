/**
 * Aggregates the `generateCzml` tool's structural input shape — no model-facing description
 * text — behind the package's `/schemas` subpath, mirroring `@cesium-ai/codegen-cesium`'s
 * identical pattern.
 */
export { generateCzmlInputShape, type GenerateCzmlInput } from "./tools/generateCzml/generateCzml.schema.js";
