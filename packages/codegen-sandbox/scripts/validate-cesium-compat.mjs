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
const installedStaticExports = Object.keys(Cesium).sort();
const blockedStaticExportSet = new Set(manifest.blockedStaticExports);
const availableStaticExports = installedStaticExports.filter(
  (exportName) => !blockedStaticExportSet.has(exportName),
);

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

for (const exportName of manifest.blockedStaticExports) {
  if (!(exportName in Cesium)) {
    errors.push(`Blocked static export no longer exists: Cesium.${exportName}`);
  }
}

for (const [valueType, fields] of Object.entries(manifest.valueTypes)) {
  if (typeof Cesium[valueType] !== "function") {
    errors.push(`Value type no longer exists or is not constructable: Cesium.${valueType}`);
  }
  if (
    !Array.isArray(fields) ||
    fields.length === 0 ||
    fields.some((field) => typeof field !== "string")
  ) {
    errors.push(`Value type fields must be a non-empty string array: Cesium.${valueType}`);
  }
}

for (const ownerName of manifest.networkBlockedPromiseOwners) {
  if (typeof Cesium[ownerName] !== "function") {
    errors.push(`Network-blocked Promise owner no longer exists: Cesium.${ownerName}`);
  }
  if (!manifest.blockedStaticExports.includes(ownerName)) {
    errors.push(
      `Network-blocked Promise owner is not in blockedStaticExports: Cesium.${ownerName}`,
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
// Computed before `abstractStubPromiseApis` deliberately: `isAbstractStubPromiseApi` actually
// *calls* the method on the class's bare prototype to observe whether it throws the expected
// DeveloperError - safe for a genuine abstract stub (throws synchronously before any real work),
// but not for a real, non-abstract method like `TaskProcessor.scheduleTask`/
// `.initWebAssemblyModule`, which would actually run (e.g. spinning up a real Worker) and can
// crash this script outright. Excluding network-blocked-owner paths first (their owner class is
// unreachable/blocked by design, so classifying them as "abstract or not" is moot) avoids ever
// invoking the check on them.
const networkBlockedPromiseOwnerSet = new Set(manifest.networkBlockedPromiseOwners);
const networkBlockedPromiseApis = unboundPromiseApis
  .filter((api) => {
    const dotIndex = api.indexOf(".");
    if (dotIndex === -1) return false;
    return networkBlockedPromiseOwnerSet.has(api.slice(0, dotIndex));
  })
  .sort();
const networkBlockedPromiseApiSet = new Set(networkBlockedPromiseApis);
const abstractStubPromiseApis = unboundPromiseApis
  .filter(
    (api) =>
      !runtimeCoveredPromisePathSet.has(api) &&
      !runtimeGapPromisePathSet.has(api) &&
      !networkBlockedPromiseApiSet.has(api) &&
      isAbstractStubPromiseApi(api),
  )
  .sort();
const abstractStubPromiseApiSet = new Set(abstractStubPromiseApis);
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
real QuickJS promise bridged via \`ctx.newPromise()\` + \`executePendingJobs()\`). Top-level Cesium
module exports are available by default except for the reviewed denylist below. This report also
inventories Promise-returning APIs discovered in \`Source/Cesium.d.ts\`, classifying each path as
runtime-tested, a known runtime gap, an abstract base-class stub, network-blocked by design, or
untested/uncovered.

- Installed CesiumJS: **${cesiumPackage.version}**
- Last reviewed CesiumJS: **${manifest.reviewedCesiumVersion}**
- Installed Cesium module exports: **${installedStaticExports.length}**
- Static exports available by default: **${availableStaticExports.length}**
- Blocked static exports: **${manifest.blockedStaticExports.length}**
- Guest value types: **${Object.keys(manifest.valueTypes).length}**
- Promise-returning declaration paths discovered: **${promiseApis.length}**
- Promise-returning paths using the dynamic bridge: **${unboundPromiseApis.length}**
- Dynamically bridged paths exercised by runtime tests: **${runtimeCoveredPromisePaths.length}**
- Dynamically bridged paths with known runtime-test gaps: **${runtimeGapPromisePaths.length}**
- Abstract base-class stubs excluded (not callable by design): **${abstractStubPromiseApis.length}**
- Network-blocked Promise candidates excluded (not callable by design): **${networkBlockedPromiseApis.length}**
- Untested/uncovered dynamic Promise candidates: **${declarationOnlyPromiseApis.length}**

## Unsupported By Design

${manifest.unsupportedCapabilities.map((item) => `- ${item}`).join("\n")}

## Blocked Static Cesium Exports

All installed top-level Cesium exports are reachable as \`Cesium.<name>\` inside the sandbox except
these reviewed denylist entries. Nested property access remains subject to \`blockedProperties\`.
Review newly installed Cesium versions before updating \`reviewedCesiumVersion\`, because new
top-level exports become available automatically under this policy.

${manifest.blockedStaticExports
  .toSorted()
  .map((exportName) => `- \`${exportName}\``)
  .join("\n")}

## Runtime-Tested Dynamic Promise APIs

These paths are exercised end-to-end through the generic host-handle bridge by
\`cesium-code-sandbox.test.ts\`. Most tests use deterministic Viewer doubles with no network, Ion,
WebGL, or browser-worker dependencies; a few (\`GroundPrimitive\`/\`GroundPolylinePrimitive.
initializeTerrainHeights\`, \`Transforms.preloadIcrfFixed\`) instead monkey-patch the real
\`Resource.prototype.fetchJson\` - the actual host-side network seam those APIs funnel through -
so no real network request is ever made.

${runtimeCoveredPromisePaths.map((api) => `- \`${api}\``).join("\n")}

## Dynamic Promise Runtime Gaps

These reachable paths are not blocked and would use the generic dynamic Promise bridge like any
other case, but are not counted as runtime-covered because they ultimately depend on a real
network fetch (\`Resource.fetchJson\` for a Cesium-bundled data asset) and/or Cesium-internal
process-global memoized state that can't be faked deterministically alongside every other
network-free case in this suite. Their tests remain visible as \`test.todo\` cases.

${formatList(runtimeGapPromisePaths, "None currently - every reachable Promise-returning path with a genuine network/global-state dependency has a dedicated runtime test instead.")}

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

These declaration paths belong to \`Resource\`/\`IonResource\` - explicitly included in
\`blockedStaticExports\` and unreachable in the sandbox for the reasons given under "Unsupported By
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
  `Cesium ${cesiumPackage.version}: ${installedStaticExports.length} installed exports, ` +
    `${availableStaticExports.length} available, ${manifest.blockedStaticExports.length} blocked; ` +
    `${unboundPromiseApis.length} Promise APIs use the dynamic bridge when reachable.`,
);
console.log(`Wrote ${path.relative(process.cwd(), reportPath)}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
}
