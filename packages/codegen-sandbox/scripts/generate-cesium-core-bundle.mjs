// Generates `src/bindings/generated/cesium-core-bundle.ts`: a self-contained IIFE bundle of real
// CesiumJS *value*-type classes (`Cartesian2`, `Cartesian3`, `Cartographic`, `Color`,
// `HeadingPitchRange`, `HeadingPitchRoll`, `NearFarScalar`, `Math`), built directly from
// `@cesium/engine`'s `Source/Core/*.js` (deep-imported, NOT the package barrel — importing the
// barrel pulls in the entire engine, including WebGL/DOM-dependent modules that can never
// resolve/run inside the QuickJS guest sandbox).
//
// These are pure, side-effect-free math/data classes with no WebGL/DOM/network dependency, so
// running the *real* CesiumJS implementation inside the guest (instead of `guest-prelude-value-
// types.ts`'s previous hand-reimplementation) removes an entire class of "the model used a real
// Cesium API this hand-rolled version doesn't cover" gaps (e.g. the full named-CSS-color table,
// exact geodetic math, `Color.fromHsl`, ...) at the cost of needing to regenerate this file
// whenever the `cesium` dependency is upgraded.
//
// Run via `npm run generate:cesium-bundle -w @cesium-ai/codegen-sandbox` (also wired into `build`).
import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../src/bindings/generated");
const outFile = path.join(outDir, "cesium-core-bundle.ts");

const entryContents = `
export { default as Cartesian2 } from "@cesium/engine/Source/Core/Cartesian2.js";
export { default as Cartesian3 } from "@cesium/engine/Source/Core/Cartesian3.js";
export { default as Cartographic } from "@cesium/engine/Source/Core/Cartographic.js";
export { default as Color } from "@cesium/engine/Source/Core/Color.js";
export { default as HeadingPitchRange } from "@cesium/engine/Source/Core/HeadingPitchRange.js";
export { default as HeadingPitchRoll } from "@cesium/engine/Source/Core/HeadingPitchRoll.js";
export { default as NearFarScalar } from "@cesium/engine/Source/Core/NearFarScalar.js";
export { default as CesiumMath } from "@cesium/engine/Source/Core/Math.js";
`;

const result = await build({
  stdin: {
    contents: entryContents,
    resolveDir: __dirname,
    loader: "js",
  },
  bundle: true,
  format: "iife",
  globalName: "__CesiumCoreBundle__",
  platform: "browser",
  treeShaking: true,
  write: false,
  logLevel: "warning",
});

let bundleSource = result.outputFiles[0].text;
// Strip esbuild's leading `"use strict";` directive: this bundle is concatenated into a larger,
// deliberately sloppy-mode guest script (see `cesium-code-sandbox.ts`'s prelude assembly) — since
// a leading directive prologue applies to the *entire* subsequent script once concatenated, not
// just this bundle, keeping it would silently flip the whole guest execution context to strict
// mode instead of only this bundle.
bundleSource = bundleSource.replace(/^"use strict";\s*/, "");

// The bundle is embedded below as the literal body of `__cesiumCoreBundleSource__` — real,
// unescaped JS with normal line breaks and syntax highlighting — instead of one giant
// JSON-escaped string literal (which was unreadable: a single line with every newline/quote
// escaped). The function is never called; `Function.prototype.toString()` (which the spec
// guarantees returns the exact original source text) recovers the bundle text back out at
// module-load time, and a simple first-`{`/last-`}` slice strips the wrapper.
const prettierConfig = (await resolveConfig(outFile)) ?? {};
const fileContents = await format(
  `// @ts-nocheck
// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run generate:cesium-bundle -w @cesium-ai/codegen-sandbox
// (see ../../../scripts/generate-cesium-core-bundle.mjs)

/**
 * Source text of a self-contained IIFE bundling real, pure CesiumJS value-type classes
 * (\`Cartesian2\`, \`Cartesian3\`, \`Cartographic\`, \`Color\`, \`HeadingPitchRange\`,
 * \`HeadingPitchRoll\`, \`NearFarScalar\`, \`Math\` as \`CesiumMath\`), built from
 * \`@cesium/engine\`'s \`Source/Core/*.js\`. Evaluating this in the QuickJS guest defines a
 * top-level \`__CesiumCoreBundle__\` object exposing each as a real class/namespace — see
 * \`guest-prelude-value-types.ts\`, which evaluates this before attaching them onto \`Cesium.*\`.
 *
 * Kept as the body of \`__cesiumCoreBundleSource__\` (never invoked) rather than a string literal
 * purely for readability — see this file's \`CESIUM_CORE_BUNDLE_SOURCE\` extraction below.
 * \`@ts-nocheck\` is required: the bundled code is plain untyped JS (esbuild output), and
 * type-checking it under this package's \`strict\` tsconfig would flood unrelated errors.
 */
function __cesiumCoreBundleSource__() {
${bundleSource}
}

const __cesiumCoreBundleFnText__ = __cesiumCoreBundleSource__.toString();
export const CESIUM_CORE_BUNDLE_SOURCE = __cesiumCoreBundleFnText__.slice(
  __cesiumCoreBundleFnText__.indexOf("{") + 1,
  __cesiumCoreBundleFnText__.lastIndexOf("}"),
);
`,
  { ...prettierConfig, filepath: outFile },
);

await mkdir(outDir, { recursive: true });
await writeFile(outFile, fileContents, "utf8");

console.log(
  `Wrote ${path.relative(process.cwd(), outFile)} (${(bundleSource.length / 1024).toFixed(1)} KB bundle)`,
);
