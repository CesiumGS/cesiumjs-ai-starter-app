import { test, expect, type Page } from "@playwright/test";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end coverage of the `executeCesiumCode` tool across a representative intent from
 * each `@cesium/cesiumjs-skills` domain — the full intent -> skill-matching -> prompt-building ->
 * model generation -> AST verification -> approval -> execution pipeline, against a real model.
 *
 * See `execute-cesium-code-domains.spec.ts` for the stubbed, deterministic counterpart and
 * `execute-cesium-code-live.spec.ts` for the single-scenario real-backend test this generalizes.
 *
 * Requires the same setup as `fly-to-paris.spec.ts`:
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * Every domain should succeed: the model calls the tool, the generated snippet passes the real
 * AST verifier, and the approved code executes against the live Viewer with no error surfaced
 * and no crash. A `{ error }` result fails the test.
 */

/**
 * One representative natural-language intent per domain, phrased to route to the right skill via
 * BM25 matching (mirrors `packages/codegen-cesium/src/pipeline/domain-coverage.test.ts`'s
 * `REPRESENTATIVE_INTENTS`) and to reliably win real model tool-choice over the narrower `flyTo`
 * tool where it would otherwise apply. Inline comments below note where and why an intent was
 * tuned to avoid a specific known failure mode.
 */
const DOMAIN_INTENTS: Record<string, string> = {
  // Names a known-good public Ion asset so the scenario is deterministic (no invented/missing
  // tileset URL). Requires VITE_CESIUM_ION_ACCESS_TOKEN in .env.
  "cesiumjs-3d-tiles":
    "load Cesium ion asset 75343 (New York City 3D Buildings) as a Cesium3DTileset and style building features by querying metadata properties",
  // Asks for heading/pitch/roll + instant snap, which the dedicated flyTo tool can't do, forcing
  // executeCesiumCode instead of the narrower tool.
  "cesiumjs-camera":
    "instantly snap the camera (no flight animation) to a view above the Grand Canyon with heading 30 degrees, pitch -60 degrees, and roll 0, using Camera.setView",
  // Uses PinBuilder for a visually-verifiable outcome, and states explicitly that
  // fromColor/fromText are synchronous (not this domain's usual async Resource.fetch* pattern) to
  // avoid the model wrongly calling .then() on the returned canvas.
  "cesiumjs-core-utilities":
    "use Cesium's PinBuilder to create a red pin marker icon — pinBuilder.fromColor(color, size) is SYNCHRONOUS and returns a canvas directly, no .then()/await needed — check it's defined with the defined() utility, and add it as a billboard entity over Berlin",
  // Reuses the known-good NYC Buildings tileset (real per-building feature IDs) and asks for
  // fragment-only recoloring, avoiding a WebGL shader-compile crash from a demo model with no
  // EXT_mesh_features data.
  "cesiumjs-custom-shader":
    "load Cesium ion asset 75343 (New York City 3D Buildings) as a Cesium3DTileset, then attach a CustomShader whose fragmentShaderText recolors each building using its EXT_mesh_features feature ID (fsInput.featureIds.featureId_0) so buildings are visibly tinted in different colors",
  "cesiumjs-entities": "add a GeoJSON polygon entity with labels using the high-level Entity API",
  "cesiumjs-imagery": "add a WMS imagery layer as a base map using an ImageryProvider",
  // Seeds a concrete entity to click plus a visible effect on pick, making the ask an unambiguous
  // live-Viewer modification instead of an abstract event-handler snippet.
  "cesiumjs-interaction":
    "add a red point entity over London, then register a ScreenSpaceEventHandler LEFT_CLICK handler that uses scene.pick to detect clicks on entities and changes the picked entity's point color to yellow",
  // Steers explicitly to the Primitive + MaterialAppearance pattern (not the Entity API), since a
  // raw Material assigned to an Entity's polygon.material throws at runtime.
  "cesiumjs-materials-shaders":
    "define a custom Fabric material with GLSL source and apply it via a Primitive + GeometryInstance + MaterialAppearance (not the Entity API) to a rectangle geometry, then add a PostProcessStage bloom post-processing effect with default settings",
  // Names a real, publicly-reachable sample glTF (Khronos's BoxAnimated) so the scenario is
  // deterministic, mirroring the cesiumjs-3d-tiles fix above.
  "cesiumjs-models-particles":
    "load the glTF model at https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb, play its animation, and add a ParticleSystem for fire at its base",
  // Supplies concrete inline GeoJSON since this app has no pre-loaded GeoJSON for the model to
  // reference.
  "cesiumjs-primitives":
    "render this GeoJSON polygon as a ground-clamped primitive for performance using GeoJsonPrimitive instead of the Entity API: a rectangle covering roughly Colorado with coordinates [[-109,37],[-102,37],[-102,41],[-109,41],[-109,37]]",
  // Ties the conversion to a visible label so the outcome is actionable rather than a pure math
  // exercise with no Viewer effect.
  "cesiumjs-spatial-math":
    "convert the camera's current Cartesian3 position to Cartographic using Ellipsoid.cartesianToCartographic, then add a label entity at that location showing the converted longitude/latitude/height",
  // Names the correct API explicitly (CesiumTerrainProvider.fromIonAssetId, not
  // Terrain.fromWorldTerrain, which only works as the Viewer constructor's terrain option) to
  // avoid a DeveloperError crash from conflating the two.
  "cesiumjs-terrain-environment":
    "using the existing Viewer instance, set viewer.scene.globe.terrainProvider to a real TerrainProvider from CesiumTerrainProvider.fromIonAssetId(1) (not Terrain.fromWorldTerrain, which only works as the Viewer constructor's terrain option), sample terrain heights at a few positions with sampleTerrainMostDetailed, and adjust atmosphere/lighting for a more dramatic look",
  "cesiumjs-time-properties":
    "make entity position time-dynamic using a SampledProperty and Clock interpolation",
  // Asks for a scene-mode change against the existing Viewer instance, forcing an actionable
  // outcome instead of the model treating "initialize a Viewer" as already-done.
  "cesiumjs-viewer-setup":
    "using the existing Viewer instance, switch the scene mode to Columbus View via Scene.morphToColumbusView, and confirm Cesium.Ion.defaultAccessToken is configured",
};

/** Collects uncaught page errors (a real crash) for the duration of a test. */
function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (err) => errors.push(err));
  return errors;
}

test.describe("executeCesiumCode — real backend, one intent per cesiumjs-skills domain", () => {
  for (const [domain, intent] of Object.entries(DOMAIN_INTENTS)) {
    test(`${domain}: a real intent is verified and executes cleanly`, async ({ page }) => {
      test.setTimeout(120_000);

      const pageErrors = trackPageErrors(page);

      await page.goto("/");
      await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });

      const input = page.locator(INPUT_SELECTOR);
      await input.fill(intent);
      await input.press("Enter");

      await expect(page.locator('[data-testid="user-bubble"]').first()).toBeVisible({
        timeout: 5_000,
      });

      // Fail fast if the backend isn't configured, instead of timing out waiting for a tool call.
      await expect(
        page.locator('[data-testid="error-text"]'),
        "backend returned an error — is the server running with a valid provider API key?",
      ).toHaveCount(0);

      // The model calls executeCesiumCode — its card appears, paused for approval.
      await expect(page.getByText(/\[tool\]\s*executeCesiumCode/)).toBeVisible({
        timeout: 90_000,
      });

      // Approve the intent — only now does the server run generation + AST verification.
      await page.getByRole("button", { name: "Approve" }).click();

      const resultBlock = page
        .locator("pre")
        .filter({ hasText: /"code"|"error"/ })
        .last();
      await expect(resultBlock).toBeVisible({ timeout: 60_000 });

      const result = JSON.parse((await resultBlock.textContent()) ?? "{}");

      // Only expected outcome: generation succeeded and the code ran with no error surfaced.
      expect(result.error, `generation/verification failed: ${result.error}`).toBeUndefined();
      expect(typeof result.code).toBe("string");
      await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);

      expect(pageErrors).toHaveLength(0);
    });
  }
});
