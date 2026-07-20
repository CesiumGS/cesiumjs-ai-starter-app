import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import * as Cesium from "cesium";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const manifestPath = path.join(packageDir, "src/bindings/cesium-capabilities.json");
const outputPath = path.join(packageDir, "src/bindings/generated/value-type-registry.ts");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const definitions = Object.entries(manifest.valueTypes);

const imports = definitions.map(([name]) => name).join(",\n  ");
const entries = definitions
  .map(
    ([name, fields]) =>
      `  { name: ${JSON.stringify(name)}, fields: ${JSON.stringify(fields)}, constructor: ${name} },`,
  )
  .join("\n");
const names = definitions.map(([name]) => name);
const aliases = names.map((name) => `const ${name} = Cesium.${name};`).join("\n");

const isPrimitive = (value) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
const guestConstants = Object.fromEntries(
  Object.entries(Cesium).filter(([, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.isFrozen(value)) {
      return false;
    }

    const entries = Object.entries(value);
    return (
      entries.length > 0 &&
      entries.every(([key, item]) => /^[A-Z][A-Z0-9_]*$/.test(key) && isPrimitive(item))
    );
  }),
);
const guestConstantNames = Object.keys(guestConstants);
const guestConstantAliases = guestConstantNames
  .map((name) => `const ${name} = Cesium.${name};`)
  .join("\n");

const source = `// GENERATED FILE - do not edit by hand.
// Regenerate with: npm run generate:value-type-registry -w @cesium-ai/codegen-sandbox

import {
  ${imports},
} from "cesium";

export interface CesiumValueTypeDefinition {
  readonly name: string;
  readonly fields: readonly string[];
  readonly constructor: new (...args: any[]) => object;
}

export const CESIUM_VALUE_TYPE_DEFINITIONS: readonly CesiumValueTypeDefinition[] = [
${entries}
];

export const CESIUM_VALUE_TYPE_NAMES = ${JSON.stringify(names)} as const;

export const CESIUM_VALUE_TYPE_GUEST_ALIASES = ${JSON.stringify(aliases)};

export const CESIUM_GUEST_CONSTANTS = ${JSON.stringify(guestConstants)} as const;

export const CESIUM_GUEST_CONSTANT_NAMES = ${JSON.stringify(guestConstantNames)} as const;

export const CESIUM_GUEST_CONSTANT_ALIASES = ${JSON.stringify(guestConstantAliases)};
`;

const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const formatted = await format(source, { ...prettierConfig, filepath: outputPath });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, formatted, "utf8");
