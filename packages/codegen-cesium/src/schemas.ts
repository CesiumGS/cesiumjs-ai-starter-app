/**
 * Aggregates every codegen-cesium tool's structural input shape — no
 * model-facing description text — behind the package's `/schemas` subpath.
 * This file imports only `zod`-based shape modules, never `ai` or a tool's
 * description strings, so the frontend can import it to validate untrusted
 * tool-call args without pulling tool *definitions* (or this package's
 * `acorn`/model-calling machinery) into the client bundle. Mirrors
 * `@cesium-ai/tools-cesium`'s identical `schemas.ts` pattern.
 */
export {
  executeCesiumCodeInputShape,
  type ExecuteCesiumCodeInput,
} from "./tools/executeCesiumCode/executeCesiumCode.schema.js";
