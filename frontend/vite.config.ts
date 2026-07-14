import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumSource = "../node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesium";

export default defineConfig({
  define: {
    // Required so CesiumJS web workers can resolve their own asset paths at runtime
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
  },
  // `quickjs-emscripten` (used by `@cesium-ai/sandbox-cesium`) ships its actual QuickJS runtime as
  // a loose `.wasm` file (via `@jitl/quickjs-wasmfile-*`) fetched by a relative URL at runtime,
  // not as a statically-analyzable import. Vite's esbuild-based dependency pre-bundling
  // (`optimizeDeps`) doesn't reliably copy that sibling `.wasm` asset alongside the bundled JS —
  // when it's missing from `node_modules/.vite/deps`, requesting it 404s and Vite's dev server
  // falls back to serving `index.html` (SPA fallback), which then fails to `WebAssembly.instantiate`
  // with an "expected magic word" error since the response body is HTML, not the wasm binary.
  // Excluding these packages from pre-bundling lets the browser load them as native ESM directly
  // from `node_modules`, where the `.wasm` file sits next to the JS and resolves correctly.
  optimizeDeps: {
    exclude: [
      "quickjs-emscripten",
      "quickjs-emscripten-core",
      "@jitl/quickjs-wasmfile-release-asyncify",
      "@jitl/quickjs-wasmfile-release-sync",
    ],
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
});
