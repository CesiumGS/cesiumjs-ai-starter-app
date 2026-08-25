/**
 * Loads and compiles the *official* CZML JSON Schema (draft-07) — vendored from
 * https://github.com/AnalyticalGraphicsInc/czml-writer/tree/main/Schema. `Document.json` (`{ type: "array",
 * items: { $ref: "Packet.json" } }`) validates an entire CZML document in one pass, transitively
 * pulling in every other vendored schema file it `$ref`s (Position.json, Billboard.json, ...).
 *
 * `loadSchema` mirrors czml-writer's own `Schema/validate.js` exactly (same URI-stripping logic),
 * but reads the vendored local copy instead of a network fetch or a czml-writer-repo-relative
 * cwd, so validation never depends on network access at runtime.
 */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type ValidateFunction } from "ajv";

// `ajv-formats` is CJS-only and its default export doesn't resolve cleanly under
// NodeNext/esModuleInterop from an ESM file — `require` it directly instead.
const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as (ajvInstance: Ajv) => Ajv;

// --- Vendored schema loading -------------------------------------------------

const SCHEMA_BASE_URL = "https://analyticalgraphicsinc.github.io/czml-writer/Schema/";
const VENDORED_SCHEMA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schema/czml",
);

async function readVendoredSchema(relativePath: string): Promise<object> {
  const contents = await readFile(path.join(VENDORED_SCHEMA_DIR, relativePath), "utf8");
  return JSON.parse(contents);
}

/** Resolves a schema's `$ref` URI to its vendored local copy instead of fetching over the network. */
function loadSchema(uri: string): Promise<object> {
  return readVendoredSchema(uri.replace(SCHEMA_BASE_URL, ""));
}

// --- Ajv setup ----------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false, loadSchema });

// Ajv core only ships a handful of built-in formats; without this, "date-time" (used by
// InterpolatableProperty.json's `epoch`) is silently ignored rather than actually validated.
addFormats(ajv);

// --- Public API -----------------------------------------------------------------

// `compileAsync` recursively resolves every `$ref` via `loadSchema` above; compiled once and
// reused, since ajv validators are stateful/reusable and recompiling per call is wasted work.
let documentValidatorPromise: Promise<ValidateFunction> | undefined;

/** The compiled validator for a whole CZML document (`Document.json`, an array of `Packet.json`). */
export function getCzmlDocumentValidator(): Promise<ValidateFunction> {
  documentValidatorPromise ??= readVendoredSchema("Document.json").then((schema) =>
    ajv.compileAsync(schema),
  );
  return documentValidatorPromise;
}
