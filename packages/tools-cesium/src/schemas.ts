/**
 * Aggregates every tool's structural input shape — no model-facing description
 * text — behind the package's `/schemas` subpath. This file imports only
 * `zod`-based shape modules, never `ai` or a tool's description strings, so the
 * frontend can import it to validate untrusted tool-call args without pulling
 * tool *definitions* into the client bundle. Add a re-export here for every new
 * tool's schema module under `./tools/<toolName>/<toolName>.schema.js`.
 */
export { flyToInputShape, type FlyToInput } from "./tools/flyTo/flyTo.schema.js";
