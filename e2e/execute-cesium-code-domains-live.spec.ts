import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  expandToolCard,
  readExecuteCesiumCodeResult,
  type ExecuteCesiumCodeResultInfo,
} from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Snapshot of observable Cesium `Viewer` state that an AI-generated snippet could plausibly
 * change, read via the dev-only `window.__cesiumViewerForE2E` test seam (see
 * `frontend/src/components/CesiumGlobe.tsx`). Comparing two snapshots proves the globe actually
 * changed, not just that no error was surfaced.
 */
interface ViewerSnapshot {
  entities: number;
  dataSources: number;
  primitives: number;
  groundPrimitives: number;
  imageryLayers: number;
  cameraPosition: { x: number; y: number; z: number };
  cameraHeading: number;
  cameraPitch: number;
  sceneMode: number;
  enableLighting: boolean;
  atmosphereHueShift: number;
}

/** Reads a `ViewerSnapshot` off the live Viewer exposed by the dev-only e2e test seam. */
async function getViewerSnapshot(page: Page): Promise<ViewerSnapshot> {
  return page.evaluate(() => {
    const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
    if (!viewer) {
      throw new Error(
        "window.__cesiumViewerForE2E is undefined — is the app running in dev mode " +
          "(`npm run dev:frontend`), and has CesiumGlobe finished mounting?",
      );
    }
    const camera = viewer.camera;
    return {
      entities: viewer.entities.values.length,
      dataSources: viewer.dataSources.length,
      primitives: viewer.scene.primitives.length,
      groundPrimitives: viewer.scene.groundPrimitives.length,
      imageryLayers: viewer.imageryLayers.length,
      cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      cameraHeading: camera.heading,
      cameraPitch: camera.pitch,
      sceneMode: viewer.scene.mode,
      enableLighting: viewer.scene.globe.enableLighting,
      atmosphereHueShift: viewer.scene.skyAtmosphere?.hueShift ?? 0,
    };
  });
}

const CAMERA_MOVE_EPSILON_METERS = 1;

function cameraDistanceMoved(before: ViewerSnapshot, after: ViewerSnapshot): number {
  const dx = after.cameraPosition.x - before.cameraPosition.x;
  const dy = after.cameraPosition.y - before.cameraPosition.y;
  const dz = after.cameraPosition.z - before.cameraPosition.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function hasChanged(before: ViewerSnapshot, after: ViewerSnapshot): boolean {
  return (
    after.entities !== before.entities ||
    after.dataSources !== before.dataSources ||
    after.primitives !== before.primitives ||
    after.groundPrimitives !== before.groundPrimitives ||
    after.imageryLayers !== before.imageryLayers ||
    after.sceneMode !== before.sceneMode ||
    after.enableLighting !== before.enableLighting ||
    after.atmosphereHueShift !== before.atmosphereHueShift ||
    cameraDistanceMoved(before, after) > CAMERA_MOVE_EPSILON_METERS
  );
}

/**
 * Baseline check applied to every domain: something observable changed (an entity/primitive/
 * imagery layer/data source was added, or the camera/scene mode moved). Polls instead of a single
 * snapshot because some effects (e.g. `Scene.morphToColumbusView`) settle a couple of seconds
 * after the tool result already appears in the transcript.
 */
async function assertSomethingChanged(page: Page, before: ViewerSnapshot, domain: string) {
  await expect(async () => {
    const current = await getViewerSnapshot(page);
    expect(hasChanged(before, current)).toBe(true);
  }, `[${domain}] expected the generated code to visibly change the Viewer (entities/primitives/imageryLayers/dataSources/camera/sceneMode/lighting)`).toPass(
    { timeout: 10_000 },
  );
}

/**
 * Stronger, domain-specific assertions layered on top of `assertSomethingChanged` for domains
 * where the expected change is unambiguous and cheap to verify precisely. Each polls the live
 * Viewer until the expected end-state is reached (or the timeout elapses), to tolerate animated
 * transitions (e.g. the Columbus View morph) that don't complete instantly.
 */
const DOMAIN_ASSERTIONS: Record<string, (page: Page, before: ViewerSnapshot) => Promise<void>> = {
  "cesiumjs-camera": async (page) => {
    // Camera.setView with heading 30°, pitch -60°, no animation — assert both landed close to
    // the requested values (radians), not just "camera moved somewhere".
    const { cameraHeading, cameraPitch } = await getViewerSnapshot(page);
    const headingDeg = (cameraHeading * 180) / Math.PI;
    const pitchDeg = (cameraPitch * 180) / Math.PI;
    expect(headingDeg, `expected camera heading ~30°, got ${headingDeg}°`).toBeGreaterThan(20);
    expect(headingDeg, `expected camera heading ~30°, got ${headingDeg}°`).toBeLessThan(40);
    expect(pitchDeg, `expected camera pitch ~-60°, got ${pitchDeg}°`).toBeGreaterThan(-70);
    expect(pitchDeg, `expected camera pitch ~-60°, got ${pitchDeg}°`).toBeLessThan(-50);
  },
  "cesiumjs-viewer-setup": async (page) => {
    // Cesium's SceneMode.COLUMBUS_VIEW === 1. `morphToColumbusView` animates over ~2s, so poll.
    await expect
      .poll(async () => (await getViewerSnapshot(page)).sceneMode, {
        message: "expected scene.mode to settle into Columbus View (1)",
        timeout: 10_000,
      })
      .toBe(1);
  },
  "cesiumjs-entities": async (page, before) =>
    assertEntityAdded(page, before, "the GeoJSON polygon entity"),
  "cesiumjs-core-utilities": async (page, before) =>
    assertEntityAdded(page, before, "the PinBuilder billboard entity"),
  "cesiumjs-interaction": async (page, before) =>
    assertEntityAdded(page, before, "the seeded red point entity over London"),
  "cesiumjs-spatial-math": async (page, before) =>
    assertEntityAdded(page, before, "the converted-coordinate label entity"),
  "cesiumjs-time-properties": async (page, before) =>
    assertEntityAdded(page, before, "the time-dynamic SampledProperty entity"),
  "cesiumjs-imagery": async (page, before) => assertImageryLayerAdded(page, before),
  "cesiumjs-3d-tiles": async (page, before) =>
    assertPrimitiveAdded(page, before, "the Cesium3DTileset"),
  "cesiumjs-custom-shader": async (page, before) =>
    assertPrimitiveAdded(page, before, "the Cesium3DTileset with CustomShader attached"),
  "cesiumjs-materials-shaders": async (page, before) =>
    assertPrimitiveAdded(page, before, "the Primitive with the custom Fabric material"),
  "cesiumjs-primitives": async (page, before) =>
    assertPrimitiveAdded(page, before, "the ground-clamped polygon primitive"),
  "cesiumjs-models-particles": async (page, before) =>
    assertPrimitiveAdded(page, before, "the glTF Model and/or ParticleSystem"),
};

/** Shared polling assertion behind `assertEntityAdded`/`assertPrimitiveAdded`/`assertImageryLayerAdded`. */
async function assertCountIncreased(
  page: Page,
  before: number,
  select: (snapshot: ViewerSnapshot) => number,
  message: string,
) {
  await expect
    .poll(async () => select(await getViewerSnapshot(page)), { message, timeout: 10_000 })
    .toBeGreaterThan(before);
}

const assertEntityAdded = (page: Page, before: ViewerSnapshot, what: string) =>
  assertCountIncreased(
    page,
    before.entities,
    (s) => s.entities,
    `expected ${what} to be added to viewer.entities`,
  );

const assertPrimitiveAdded = (page: Page, before: ViewerSnapshot, what: string) =>
  assertCountIncreased(
    page,
    before.primitives + before.groundPrimitives,
    (s) => s.primitives + s.groundPrimitives,
    `expected ${what} to be added to scene.primitives or scene.groundPrimitives`,
  );

const assertImageryLayerAdded = (page: Page, before: ViewerSnapshot) =>
  assertCountIncreased(
    page,
    before.imageryLayers,
    (s) => s.imageryLayers,
    "expected the WMS imagery layer to be added",
  );

/**
 * Real end-to-end coverage of the `executeCesiumCode` tool: one representative intent per
 * `@cesium/cesiumjs-skills` domain, exercising the full intent -> skill-matching -> prompt-
 * building -> model generation -> AST verification -> approval -> execution pipeline against a
 * real model.
 *
 * See `execute-cesium-code-domains.spec.ts` for the stubbed, deterministic counterpart, and
 * `execute-cesium-code-live.spec.ts` for the single-scenario test this generalizes.
 *
 * Setup (same as `fly-to-paris.spec.ts`):
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * Each domain must: call the tool, pass AST verification, and execute against the live Viewer
 * with no error or crash — a `{ error }` result fails the test. It also captures a
 * `ViewerSnapshot` before submitting the intent and asserts the globe visibly changed —
 * generically (an entity/primitive/imagery layer was added, or the camera/scene mode moved), or
 * with a stronger domain-specific check where the expected outcome is unambiguous (e.g. camera
 * heading/pitch, or scene mode after a Columbus View morph). This catches "sandbox reports
 * success but nothing visibly changed" bugs that a bare no-error assertion would miss.
 */

/**
 * One representative natural-language intent per domain, phrased to (a) route to the right skill
 * via BM25 matching (mirrors `REPRESENTATIVE_INTENTS` in
 * `packages/codegen-cesium/src/pipeline/domain-coverage.test.ts`) and (b) reliably beat the
 * narrower `flyTo` tool in the model's tool choice. Comments below flag intents tuned to dodge a
 * specific known failure mode.
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
  // Uses PinBuilder (visually verifiable) and explicitly notes fromColor/fromText are
  // synchronous — unlike this domain's usual async Resource.fetch* — so the model doesn't
  // wrongly call .then() on the returned canvas.
  "cesiumjs-core-utilities":
    "use Cesium's PinBuilder to create a red pin marker icon — pinBuilder.fromColor(color, size) is SYNCHRONOUS and returns a canvas directly, no .then()/await needed — check it's defined with the defined() utility, and add it as a billboard entity over Berlin",
  // Reuses the known-good NYC Buildings tileset (real per-building feature IDs) for fragment-only
  // recoloring, avoiding a shader-compile crash from a demo model lacking EXT_mesh_features data.
  "cesiumjs-custom-shader":
    "load Cesium ion asset 75343 (New York City 3D Buildings) as a Cesium3DTileset, then attach a CustomShader whose fragmentShaderText recolors each building using its EXT_mesh_features feature ID (fsInput.featureIds.featureId_0) so buildings are visibly tinted in different colors",
  "cesiumjs-entities": "add a GeoJSON polygon entity with labels using the high-level Entity API",
  "cesiumjs-imagery": "add a WMS imagery layer as a base map using an ImageryProvider",
  // Seeds an entity, then does a synchronous scene.pick right after — a real, single-script
  // exercise of the domain's pick API. Deliberately avoids registering a ScreenSpaceEventHandler:
  // any callback would fire after this script's VM is disposed, which the sandbox can't support
  // (same reason CallbackProperty/setTimeout/addEventListener are disallowed). Also uses a fixed
  // literal Cartesian2 instead of deriving one from scene.canvas/viewer.container, since those are
  // blocked DOM-escape guards even via helpers like SceneTransforms.worldToWindowCoordinates.
  "cesiumjs-interaction":
    "add a red point entity over London, then in the SAME script (do not register a ScreenSpaceEventHandler or any other callback — it cannot run after this script finishes) call viewer.scene.pick with a fixed literal screen position such as new Cesium.Cartesian2(400, 300) — do NOT read viewer.scene.canvas or viewer.container to compute a position, they are unavailable; if Cesium.defined() confirms something was picked, change its point color to yellow",
  // Steers explicitly to the Primitive + MaterialAppearance pattern (not the Entity API), since a
  // raw Material assigned to an Entity's polygon.material throws at runtime.
  "cesiumjs-materials-shaders":
    "define a custom Fabric material with GLSL source and apply it via a Primitive + GeometryInstance + MaterialAppearance (not the Entity API) to a rectangle geometry, then add a PostProcessStage bloom post-processing effect with default settings",
  // Names a real, public sample glTF (Khronos's BoxAnimated) for determinism, mirroring the
  // cesiumjs-3d-tiles fix above. Doesn't ask to play the animation: Cesium only finishes loading
  // animation data on a later render tick after fromGltfAsync resolves (readyEvent fires then, not
  // at promise resolution) — reacting to that is the same single-script impossibility as a
  // ScreenSpaceEventHandler callback.
  "cesiumjs-models-particles":
    "load the glTF model at https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb and add it to the scene (do not call model.activeAnimations.addAll or otherwise play its animation), and add a ParticleSystem for fire at its base — for the particle's image, use new Cesium.PinBuilder().fromColor(Cesium.Color.ORANGE, size) (synchronous, returns a real canvas) instead of drawing your own canvas with document.createElement",
  // Supplies inline GeoJSON since the app has none pre-loaded. Explicitly forbids removeAll()
  // first — it's blocked by the sandbox's security guardrail, but the model sometimes reaches for
  // it to "start clean" even though nothing needs clearing.
  "cesiumjs-primitives":
    "render this GeoJSON polygon as a ground-clamped primitive for performance using GeoJsonPrimitive instead of the Entity API: a rectangle covering roughly Colorado with coordinates [[-109,37],[-102,37],[-102,41],[-109,41],[-109,37]]. Just add the new primitive — do not call removeAll() or clear any existing primitives/entities first.",
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

/** Clicks Approve, waits for the tool card's code/error panel, then reads the settled result. */
async function approveAndAwaitResult(
  page: Page,
): Promise<{ toolCard: Locator; result: ExecuteCesiumCodeResultInfo }> {
  await page.getByRole("button", { name: "Approve" }).click();

  const toolCard = await expandToolCard(page, "executeCesiumCode");
  await expect(
    toolCard
      .locator('pre[class*="codeBlock"]')
      .or(page.locator('[data-testid="generation-error-panel"]')),
  ).toBeVisible({ timeout: 60_000 });

  return { toolCard, result: await readSettledExecuteCesiumCodeResult(page, toolCard) };
}

/**
 * Approves the pending `executeCesiumCode` call and reads its result. If the result has a runtime
 * `executionError`, gives the model a bounded number of chances to self-correct: a runtime failure
 * often triggers an immediate retry with a fixed snippet, which pauses on its own new approval
 * request. Without retrying here, that retry's Approve button is never clicked, so the
 * (successful) corrected code never runs and `assertSomethingChanged` times out.
 */
async function approveAndReadExecuteCesiumCodeResult(
  page: Page,
): Promise<{ toolCard: Locator; result: ExecuteCesiumCodeResultInfo }> {
  const MAX_RETRIES = 2;

  let { toolCard, result } = await approveAndAwaitResult(page);

  for (let attempt = 0; attempt < MAX_RETRIES && result.executionError; attempt++) {
    const retryApproveButton = page.getByRole("button", { name: "Approve" });
    const retryRequested = await retryApproveButton
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!retryRequested) break;

    ({ toolCard, result } = await approveAndAwaitResult(page));
  }

  return { toolCard, result };
}

/**
 * Reads the `executeCesiumCode` result only after giving client-side execution a chance to land
 * in the DOM — not immediately once the tool card's codeBlock/generation-error-panel appears.
 *
 * That first DOM update only reflects the server-side response (codegen + AST verification); the
 * approval-resume reply text is deliberately suppressed (see `chat-router.ts`'s
 * `suppressTextChunks`) because it can't yet know whether the code actually ran. The real outcome
 * only lands after `ChatPanel.tsx`'s `handleServerToolResult` executes the code against the live
 * Viewer and, on failure, fires a follow-up request that renders an `execution-error-panel`.
 * Reading too early always finds `executionError` `undefined`, silently treating a runtime crash
 * as success — this previously let 3 of 14 domains ("interaction", "models-particles",
 * "time-properties") pass despite a genuine `Sandbox run failed` console error (see the
 * "execute-cesium-code sandbox test race" repo note): a partial mutation before the failing line
 * was enough to satisfy `assertSomethingChanged`, masking the failure.
 */
async function readSettledExecuteCesiumCodeResult(
  page: Page,
  toolCard: Locator,
): Promise<ExecuteCesiumCodeResultInfo> {
  // No client-side execution is ever attempted for a generation/verification failure (there's no
  // code to run) — nothing to wait for.
  if ((await toolCard.locator('pre[class*="codeBlock"]').count()) === 0) {
    return readExecuteCesiumCodeResult(toolCard);
  }
  // Give the execution-error-panel a bounded grace window to appear — long enough to cover the
  // sandbox's own execution timeout (5s as configured in this app) plus the follow-up request's
  // round trip. A timeout here is the expected/common case (success) and is not itself a failure;
  // it just means we waited long enough to trust that no `executionError` is coming.
  await page
    .locator('[data-testid="execution-error-panel"]')
    .last()
    .waitFor({ state: "attached", timeout: 8_000 })
    .catch(() => {});
  return readExecuteCesiumCodeResult(toolCard);
}

test.describe("executeCesiumCode — real backend, one intent per cesiumjs-skills domain", () => {
  for (const [domain, intent] of Object.entries(DOMAIN_INTENTS)) {
    test(`${domain}: a real intent is verified and executes cleanly`, async ({ page }) => {
      test.setTimeout(120_000);

      const pageErrors = trackPageErrors(page);
      page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));

      await page.goto("/");
      await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });

      // Baseline Viewer state, captured before the intent is even submitted, so we can later
      // prove the generated code actually changed something real on the live globe rather than
      // just running without an error.
      const before = await getViewerSnapshot(page);

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

      // Approve the intent (and any subsequent self-correction retry) — only now does the server
      // run generation + AST verification.
      const { toolCard, result } = await approveAndReadExecuteCesiumCodeResult(page);

      // Only expected outcome: generation succeeded and the code ran with no error surfaced.
      expect(result.error, `generation/verification failed: ${result.error}`).toBeUndefined();
      // `executionError` is a distinct field from `error`: the code passed AST verification and
      // "succeeded" from the tool's perspective, but threw at runtime against the live Viewer
      // (see `handleServerToolResult`'s `continueConversation` feedback loop). Silently ignoring
      // this previously let real runtime failures pass this test undetected.
      expect(
        result.executionError,
        `runtime execution failed: ${result.executionError}`,
      ).toBeUndefined();
      expect(result.hasCode).toBe(true);
      await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);

      expect(pageErrors).toHaveLength(0);

      // Prove the globe actually changed as expected — not just "no error was shown".
      await assertSomethingChanged(page, before, domain);
      await DOMAIN_ASSERTIONS[domain]?.(page, before);
    });
  }
});
