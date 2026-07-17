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

for (const valueType of manifest.valueTypes) {
  if (typeof Cesium[valueType] !== "function") {
    errors.push(`Value type no longer exists or is not constructable: Cesium.${valueType}`);
  }
}

for (const ownerName of manifest.networkBlockedPromiseOwners) {
  if (typeof Cesium[ownerName] !== "function") {
    errors.push(`Network-blocked Promise owner no longer exists: Cesium.${ownerName}`);
  }
  if (manifest.staticExports.includes(ownerName)) {
    errors.push(
      `Network-blocked Promise owner is also an allowed static export, contradicting the network block: Cesium.${ownerName}`,
    );
  }
}

// Some base "interface" classes (TerrainProvider, TerrainData, VoxelProvider, GeocoderService, ...)
// declare Promise-returning methods purely for subclasses to override. Cesium marks these as
// not-directly-callable in one of two equivalent ways depending on the class: either the base
// prototype method is itself assigned to DeveloperError.throwInstantiationError (e.g.
// TerrainProvider.prototype.requestTileGeometry), or the method body just calls
// DeveloperError.throwInstantiationError() immediately (e.g. VoxelProvider.prototype.requestData).
// Either way, calling the base method directly always throws synchronously instead of returning a
// real Promise, so it can never be a genuine dynamic Promise candidate. Detect both forms at
// runtime (rather than hardcoding a class list) so the check stays correct as Cesium adds/removes
// abstract methods across versions.
function isAbstractStubPromiseApi(api) {
  const dotIndex = api.indexOf(".");
  if (dotIndex === -1) return false;
  const ownerName = api.slice(0, dotIndex);
  const methodName = api.slice(dotIndex + 1);
  const owner = Cesium[ownerName];
  if (typeof owner !== "function" || owner.prototype === undefined) return false;
  const method = owner.prototype[methodName];
  if (typeof method !== "function") return false;
  if (method === Cesium.DeveloperError.throwInstantiationError) return true;
  try {
    method.call(owner.prototype);
    return false;
  } catch (error) {
    return (
      error instanceof Cesium.DeveloperError &&
      error.message === "This function defines an interface and should not be called directly."
    );
  }
}

const promiseApis = collectPromiseApis(declarationText);
const unboundPromiseApis = promiseApis;
const runtimeCoveredPromisePaths = [...manifest.dynamicPromiseRuntimeCoverage].sort();
const runtimeCoveredPromisePathSet = new Set(runtimeCoveredPromisePaths);
const runtimeGapPromisePaths = [...manifest.dynamicPromiseRuntimeGaps].sort();
const runtimeGapPromisePathSet = new Set(runtimeGapPromisePaths);
const abstractStubPromiseApis = unboundPromiseApis
  .filter(
    (api) =>
      !runtimeCoveredPromisePathSet.has(api) &&
      !runtimeGapPromisePathSet.has(api) &&
      isAbstractStubPromiseApi(api),
  )
  .sort();
const abstractStubPromiseApiSet = new Set(abstractStubPromiseApis);
const networkBlockedPromiseOwnerSet = new Set(manifest.networkBlockedPromiseOwners);
const networkBlockedPromiseApis = unboundPromiseApis
  .filter((api) => {
    const dotIndex = api.indexOf(".");
    if (dotIndex === -1) return false;
    return networkBlockedPromiseOwnerSet.has(api.slice(0, dotIndex));
  })
  .sort();
const networkBlockedPromiseApiSet = new Set(networkBlockedPromiseApis);
const declarationOnlyPromiseApis = unboundPromiseApis.filter(
  (api) =>
    !runtimeCoveredPromisePathSet.has(api) &&
    !runtimeGapPromisePathSet.has(api) &&
    !abstractStubPromiseApiSet.has(api) &&
    !networkBlockedPromiseApiSet.has(api),
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

function formatList(apis, emptyMessage) {
  return apis.length > 0 ? apis.map((api) => `- \`${api}\``).join("\n") : emptyMessage;
}

const report = `# CesiumJS Sandbox Compatibility

Generated by \`npm run validate:cesium-compat -w @cesium-ai/codegen-sandbox\`.

Every host call the sandbox bridges (property get/set, function apply, construct) goes through
the same generic mechanism regardless of which Cesium API is involved - a synchronous result is
just serialized straight back to the guest, with nothing version-specific that could break. A
Promise-returning result is the one shape that needs different, non-trivial handling instead (a
real QuickJS promise bridged via \`ctx.newPromise()\` + \`executePendingJobs()\`, previously the
source of real hangs/crashes under an earlier Asyncify-based design - see the "Known Dynamic
Promise Test Gap" section below). This report therefore only inventories Promise-returning Cesium
APIs discovered in \`Source/Cesium.d.ts\`, classifying each reachable path as runtime-tested, a
known runtime gap, an abstract base-class stub, network-blocked by design, or untested/uncovered.

- Installed CesiumJS: **${cesiumPackage.version}**
- Last reviewed CesiumJS: **${manifest.reviewedCesiumVersion}**
- Allowed static exports: **${manifest.staticExports.length}**
- Guest value types: **${manifest.valueTypes.length}**
- Promise-returning declaration paths discovered: **${promiseApis.length}**
- Promise-returning paths using the dynamic bridge: **${unboundPromiseApis.length}**
- Dynamically bridged paths exercised by runtime tests: **${runtimeCoveredPromisePaths.length}**
- Dynamically bridged paths with known runtime-test gaps: **${runtimeGapPromisePaths.length}**
- Abstract base-class stubs excluded (not callable by design): **${abstractStubPromiseApis.length}**
- Network-blocked Promise candidates excluded (not callable by design): **${networkBlockedPromiseApis.length}**
- Untested/uncovered dynamic Promise candidates: **${declarationOnlyPromiseApis.length}**

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

## Untested Dynamic Promise Candidates (Not Yet Covered)

These declaration paths do not have named bindings. When reachable through the reviewed static
exports or Viewer object graph, their returned Promises use the generic dynamic Promise bridge.
They are not invoked individually by the unit suite because many require credentials, browser
rendering state, workers, or provider instances that are impractical to fake deterministically -
distinct from the Abstract Base-Class Stubs and Network-Blocked sections below, which are excluded
here because they can never be reachable at all, not merely untested/uncovered. This inventory is
compatibility information, not a guarantee that every remaining path is reachable in the sandbox.

${formatList(declarationOnlyPromiseApis, "None currently - every discovered Promise-returning declaration path is either runtime-tested, a known runtime gap, an abstract base-class stub, or network-blocked by design.")}

## Abstract Base-Class Stubs (Not Directly Callable)

These declaration paths belong to base "interface" classes (\`TerrainProvider\`, \`TerrainData\`,
\`VoxelProvider\`, \`GeocoderService\`, ...) whose own prototype method is wired to
\`DeveloperError.throwInstantiationError\` - calling the base method directly always throws
synchronously instead of returning a real Promise, so it is never a genuine dynamic Promise
candidate. Detected at runtime against the installed Cesium build, not hardcoded, so this list
self-corrects across Cesium versions. Every concrete subclass override that overrides one of these
(e.g. \`CesiumTerrainProvider.requestTileGeometry\`, \`HeightmapTerrainData.upsample\`,
\`Cesium3DTilesVoxelProvider.requestData\`, \`IonGeocoderService.geocode\`) is tracked separately
above and is excluded from this section.

${formatList(abstractStubPromiseApis, "None currently.")}

## Network-Blocked Dynamic Promise Candidates (Excluded By Design)

These declaration paths belong to \`Resource\`/\`IonResource\` - already explicitly excluded from
\`staticExports\` and unreachable in the sandbox for the reasons given under "Unsupported By
Design" above (unrestricted network access, including mutating HTTP verbs and credentialed Ion
asset fetches). Listed here separately, distinct from genuine untested/uncovered candidates, so this
inventory doesn't imply they are merely untested rather than deliberately blocked.

${formatList(networkBlockedPromiseApis, "None currently.")}

## Known Dynamic Promise Test Gap

- A rejected dynamically bridged host Promise can trigger a native QuickJS crash instead of
  producing a structured sandbox error. The unit suite records this case as \`test.todo\`.
- A second dynamically bridged Promise can, in some as-yet-unreproduced-deterministically
  circumstances, trigger the same native QuickJS crash instead of resolving normally (multiple
  dynamically bridged Promises in one script are otherwise supported and covered by passing
  tests). The unit suite records this remaining edge case as \`test.todo\`.
`;

await writeFile(reportPath, report, "utf8");

console.log(
  `Cesium ${cesiumPackage.version}: ${manifest.staticExports.length} static exports, ` +
    `${unboundPromiseApis.length} Promise APIs use the dynamic bridge when reachable.`,
);
console.log(`Wrote ${path.relative(process.cwd(), reportPath)}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
}
