import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as Cesium from "cesium";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const manifestPath = path.join(packageDir, "src/bindings/cesium-capabilities.json");
const reportPath = path.join(packageDir, "CESIUM_COMPATIBILITY.md");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const require = createRequire(import.meta.url);
const cesiumEntry = require.resolve("cesium");

function findPackageRoot(entryPath) {
  let directory = path.dirname(entryPath);
  while (true) {
    const packagePath = path.join(directory, "package.json");
    if (existsSync(packagePath)) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Could not locate package.json above ${entryPath}`);
    directory = parent;
  }
}

const cesiumPackageDir = findPackageRoot(cesiumEntry);
const cesiumPackage = JSON.parse(
  await readFile(path.join(cesiumPackageDir, "package.json"), "utf8"),
);
const declarationPath = path.join(cesiumPackageDir, "Source/Cesium.d.ts");
const declarationText = await readFile(declarationPath, "utf8");

function resolveRuntimePath(dottedPath) {
  const parts = dottedPath.split(".");
  if (parts[0] === "Viewer") return { declarationOnly: true };
  let value = Cesium;
  for (const part of parts) value = value?.[part];
  return { value };
}

function collectPromiseApis(sourceText) {
  const source = ts.createSourceFile(
    declarationPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const results = new Set();

  function visit(node, owner = "") {
    let nextOwner = owner;
    if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
      nextOwner = node.name.getText(source);
    } else if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
      nextOwner = node.name.getText(source);
    }

    if (
      (ts.isMethodDeclaration(node) ||
        ts.isMethodSignature(node) ||
        ts.isFunctionDeclaration(node)) &&
      node.name &&
      node.type?.getText(source).includes("Promise<")
    ) {
      const name = node.name.getText(source);
      results.add(nextOwner ? `${nextOwner}.${name}` : name);
    }

    ts.forEachChild(node, (child) => visit(child, nextOwner));
  }

  visit(source);
  return [...results].sort();
}

const errors = [];
const warnings = [];

if (cesiumPackage.version !== manifest.reviewedCesiumVersion) {
  errors.push(
    `Installed Cesium ${cesiumPackage.version} has not been reviewed; manifest records ${manifest.reviewedCesiumVersion}.`,
  );
}

for (const exportName of manifest.staticExports) {
  if (!(exportName in Cesium)) errors.push(`Static export no longer exists: Cesium.${exportName}`);
}

for (const binding of manifest.asyncBindings) {
  const resolved = resolveRuntimePath(binding.cesiumPath);
  if (!resolved.declarationOnly && typeof resolved.value !== "function") {
    errors.push(`Async binding path is not callable: Cesium.${binding.cesiumPath}`);
  }
}

const duplicateHostNames = manifest.asyncBindings
  .map(({ hostName }) => hostName)
  .filter((name, index, names) => names.indexOf(name) !== index);
if (duplicateHostNames.length > 0) {
  errors.push(`Duplicate async host names: ${[...new Set(duplicateHostNames)].join(", ")}`);
}

for (const valueType of manifest.valueTypes) {
  if (typeof Cesium[valueType] !== "function") {
    errors.push(`Value type no longer exists or is not constructable: Cesium.${valueType}`);
  }
}

const promiseApis = collectPromiseApis(declarationText);
const supportedPromisePaths = new Set(manifest.asyncBindings.map(({ cesiumPath }) => cesiumPath));
const discoveredSupported = promiseApis.filter((api) => supportedPromisePaths.has(api));
const unboundPromiseApis = promiseApis.filter((api) => !supportedPromisePaths.has(api));
const runtimeCoveredPromisePaths = [...manifest.dynamicPromiseRuntimeCoverage].sort();
const runtimeCoveredPromisePathSet = new Set(runtimeCoveredPromisePaths);
const runtimeGapPromisePaths = [...manifest.dynamicPromiseRuntimeGaps].sort();
const runtimeGapPromisePathSet = new Set(runtimeGapPromisePaths);
const declarationOnlyPromiseApis = unboundPromiseApis.filter(
  (api) => !runtimeCoveredPromisePathSet.has(api) && !runtimeGapPromisePathSet.has(api),
);

for (const api of [...runtimeCoveredPromisePaths, ...runtimeGapPromisePaths]) {
  if (!unboundPromiseApis.includes(api)) {
    errors.push(
      `Dynamic Promise runtime coverage path is not an unbound Promise declaration: ${api}`,
    );
  }
}

for (const api of runtimeCoveredPromisePaths) {
  if (runtimeGapPromisePathSet.has(api)) {
    errors.push(`Dynamic Promise path is both runtime-covered and a runtime gap: ${api}`);
  }
}

for (const binding of manifest.asyncBindings) {
  if (!promiseApis.includes(binding.cesiumPath)) {
    warnings.push(
      `Async binding was not recognized as Promise-returning in Cesium.d.ts: ${binding.cesiumPath}`,
    );
  }
}

const report = `# CesiumJS Sandbox Compatibility

Generated by \`npm run validate:cesium-compat -w @cesium-ai/codegen-sandbox\`.

- Installed CesiumJS: **${cesiumPackage.version}**
- Last reviewed CesiumJS: **${manifest.reviewedCesiumVersion}**
- Allowed static exports: **${manifest.staticExports.length}**
- Guest value types: **${manifest.valueTypes.length}**
- Explicit async bindings: **${manifest.asyncBindings.length}**
- Promise-returning declaration paths discovered: **${promiseApis.length}**
- Promise-returning paths using the dynamic bridge: **${unboundPromiseApis.length}**
- Dynamically bridged paths exercised by runtime tests: **${runtimeCoveredPromisePaths.length}**
- Dynamically bridged paths with known runtime-test gaps: **${runtimeGapPromisePaths.length}**
- Declaration-only dynamic Promise candidates: **${declarationOnlyPromiseApis.length}**

## Explicit Async Bindings

${manifest.asyncBindings.map(({ hostName, cesiumPath }) => `- \`${cesiumPath}\` via \`${hostName}\``).join("\n")}

## Unsupported By Design

${manifest.unsupportedCapabilities.map((item) => `- ${item}`).join("\n")}

## Runtime-Tested Dynamic Promise APIs

These paths are exercised end-to-end through the generic host-handle bridge by
\`cesium-code-sandbox.test.ts\`. The tests use deterministic Viewer doubles rather than network,
Ion, WebGL, or browser-worker dependencies.

${runtimeCoveredPromisePaths.map((api) => `- \`${api}\``).join("\n")}

## Dynamic Promise Runtime Gaps

These reachable paths were attempted with deterministic Viewer doubles but are not counted as
covered because the current QuickJS Asyncify build can hang or crash while resolving them. Their
tests remain visible as \`test.todo\` cases.

${runtimeGapPromisePaths.map((api) => `- \`${api}\``).join("\n")}

## Declaration-Only Dynamic Promise Candidates

These declaration paths do not have named bindings. When reachable through the reviewed static
exports or Viewer object graph, their returned Promises use the generic one-call Asyncify bridge.
They are not invoked individually by the unit suite because many require credentials, network,
browser rendering state, workers, provider instances, or mutating HTTP operations. This inventory
is compatibility information, not a guarantee that every path is reachable in the sandbox.

${declarationOnlyPromiseApis.map((api) => `- \`${api}\``).join("\n")}

## Known Dynamic Promise Test Gap

- A rejected dynamically bridged host Promise can trigger a native QuickJS Asyncify crash instead
  of producing a structured sandbox error. The unit suite records this case as \`test.todo\`.
- A second dynamically discovered Promise in one script cannot currently be exercised safely:
  after the first Asyncify round-trip, the current QuickJS-wasm build can crash instead of
  propagating the intended one-call guard. The unit suite records this case as \`test.todo\`.
`;

await writeFile(reportPath, report, "utf8");

console.log(
  `Cesium ${cesiumPackage.version}: ${manifest.staticExports.length} static exports, ` +
    `${discoveredSupported.length}/${manifest.asyncBindings.length} async declarations recognized, ` +
    `${unboundPromiseApis.length} Promise APIs use the dynamic bridge when reachable.`,
);
console.log(`Wrote ${path.relative(process.cwd(), reportPath)}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
}
