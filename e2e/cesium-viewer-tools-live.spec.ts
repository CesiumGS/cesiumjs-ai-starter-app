import { test, expect, type Page } from "@playwright/test";
import { expandToolCard } from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end coverage of every `@cesium-ai/tools-schemas` viewer tool this app enables
 * (`shared/src/enabled-tools.ts`), EXCEPT `executeCesiumCode`, which already has its own dedicated
 * live specs (`execute-cesium-code-domains-live.spec.ts`/`execute-cesium-code-live.spec.ts`).
 *
 * Like those specs, this one does **not** mock `/api/chat`: prompts go to the real model running
 * on the ALREADY-RUNNING backend, the model picks a tool, the browser executes it against the
 * live CesiumJS `Viewer`, and the result is posted back and rendered in the transcript.
 *
 * How to run (two terminals):
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * Each tool gets its own `test()` so a single failure is reported against exactly that tool,
 * rather than an entire domain group. Some tools have no natural standalone precondition (e.g.
 * `entityList`/`entityRemove` need an entity to already exist) — those tests run a short SETUP
 * prompt first (same page/conversation, not separately asserted) before the prompt that actually
 * exercises the tool under test. Prompts are phrased to reduce ambiguity in the model's tool
 * choice (see the many prior lessons in this repo's memory about real-model tool-selection
 * flakiness): each names its target tool/API explicitly and, where relevant, excludes an adjacent
 * tool (e.g. "using Camera.setView, not flyTo").
 */

interface ViewerSnapshot {
  entities: number;
  imageryLayers: number;
  cameraPosition: { x: number; y: number; z: number };
  enableLighting: boolean;
  clockMultiplier: number;
}

/** Reads a `ViewerSnapshot` off the live Viewer exposed by the dev-only `window.__cesiumViewerForE2E` test seam. */
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
      imageryLayers: viewer.imageryLayers.length,
      cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      enableLighting: viewer.scene.globe.enableLighting,
      clockMultiplier: viewer.clock.multiplier,
    };
  });
}

function cameraDistanceMoved(before: ViewerSnapshot, after: ViewerSnapshot): number {
  const dx = after.cameraPosition.x - before.cameraPosition.x;
  const dy = after.cameraPosition.y - before.cameraPosition.y;
  const dz = after.cameraPosition.z - before.cameraPosition.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

interface CameraGeodeticPosition {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

/**
 * Reads the live camera's geodetic position/orientation directly off the Viewer, using the exact
 * same math the `cameraGetPosition` executor uses (`positionCartographic` + `heading`/`pitch`/
 * `roll` converted from radians) — an independent oracle to check a tool's returned/applied values
 * against, not just that a call "succeeded".
 */
async function getCameraGeodeticPosition(page: Page): Promise<CameraGeodeticPosition> {
  return page.evaluate(() => {
    const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
    if (!viewer) throw new Error("window.__cesiumViewerForE2E is undefined");
    const camera = viewer.camera;
    const toDegrees = (radians: number) => (radians * 180) / Math.PI;
    const cartographic = camera.positionCartographic;
    return {
      longitude: toDegrees(cartographic.longitude),
      latitude: toDegrees(cartographic.latitude),
      height: cartographic.height,
      heading: toDegrees(camera.heading),
      pitch: toDegrees(camera.pitch),
      roll: toDegrees(camera.roll),
    };
  });
}

/** One conversational turn: a prompt expected to invoke exactly `toolName`. */
interface ToolStep {
  prompt: string;
  toolName: string;
}

/**
 * Submits `step.prompt`, waits for `step.toolName`'s tool card to appear with a settled result,
 * and returns the result `<pre>`'s content parsed as JSON (every tool result in this app is a
 * flat/JSON-serializable object — see `formatToolPayload`'s doc comment — so this always parses).
 * Playwright's `.fill()`/`.press()` auto-wait for the input to be actionable, which covers the
 * input being disabled while a previous turn is still streaming — no manual "wait for idle" step
 * needed between steps.
 */
async function runToolStep(page: Page, step: ToolStep): Promise<Record<string, unknown>> {
  const input = page.locator(INPUT_SELECTOR);
  await input.fill(step.prompt);
  await input.press("Enter");

  await expect(
    page.getByText(new RegExp(`\\[tool\\]\\s*${step.toolName}\\b`)).last(),
    `expected the model to call ${step.toolName} for prompt: "${step.prompt}"`,
  ).toBeVisible({ timeout: 90_000 });

  const toolCard = await expandToolCard(page, step.toolName);
  const resultBlock = toolCard.locator('pre[class*="toolResult"]');
  await expect(resultBlock).toBeVisible({ timeout: 30_000 });
  const result = JSON.parse((await resultBlock.textContent()) ?? "{}") as Record<string, unknown>;

  await expect(
    page.locator('[data-testid="error-text"]'),
    `backend/tool reported an error after: "${step.prompt}"`,
  ).toHaveCount(0);
  expect(result.success, `expected ${step.toolName}'s result to report success`).toBe(true);

  return result;
}

test.describe("Cesium viewer tools — end-to-end against the live backend", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });
  });

  // ---- camera tools -------------------------------------------------------------------------

  test("cameraSetView", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const before = await getViewerSnapshot(page);

    await runToolStep(page, {
      prompt:
        "Using Camera.setView (not flyTo — no flight animation, snap instantly), set the camera view above London at latitude 51.5074, longitude -0.1278, height 5000 meters, heading 45 degrees, pitch -90 degrees, roll 0.",
      toolName: "cameraSetView",
    });

    const after = await getViewerSnapshot(page);
    expect(
      cameraDistanceMoved(before, after),
      "expected the camera to have visibly moved after setView",
    ).toBeGreaterThan(1);

    // cameraSetView's own result carries no data (`{ success: true }` only) — verify the actual
    // applied camera state matches the requested London view instead of just checking "no error".
    const geodetic = await getCameraGeodeticPosition(page);
    expect(geodetic.latitude).toBeCloseTo(51.5074, 2);
    expect(geodetic.longitude).toBeCloseTo(-0.1278, 2);
    expect(geodetic.height).toBeCloseTo(5000, -1);
    expect(geodetic.heading).toBeCloseTo(45, 0);
    expect(geodetic.pitch).toBeCloseTo(-90, 0);
  });

  test("cameraGetPosition", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt: "Get the camera's exact current position and orientation.",
      toolName: "cameraGetPosition",
    });

    // Cross-check the tool's returned fields against the same values read directly off the live
    // Viewer — proves the RESULT payload actually reflects real state, not just that it's present.
    const geodetic = await getCameraGeodeticPosition(page);
    expect(typeof result.longitude).toBe("number");
    expect(typeof result.latitude).toBe("number");
    expect(typeof result.height).toBe("number");
    expect(typeof result.heading).toBe("number");
    expect(typeof result.pitch).toBe("number");
    expect(typeof result.roll).toBe("number");
    expect(result.longitude).toBeCloseTo(geodetic.longitude, 3);
    expect(result.latitude).toBeCloseTo(geodetic.latitude, 3);
    expect(result.height).toBeCloseTo(geodetic.height, 0);
    expect(result.heading).toBeCloseTo(geodetic.heading, 1);
    expect(result.pitch).toBeCloseTo(geodetic.pitch, 1);
    expect(result.roll).toBeCloseTo(geodetic.roll, 1);
  });

  test("cameraSetControllerOptions", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    await runToolStep(page, {
      prompt:
        "Using the camera controller options (not the camera view itself), disable camera zooming entirely by setting enableZoom to false.",
      toolName: "cameraSetControllerOptions",
    });

    // The result carries no data — verify the actual controller property was applied.
    const enableZoom = await page.evaluate(
      () =>
        (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E.scene
          .screenSpaceCameraController.enableZoom,
    );
    expect(enableZoom, "expected screenSpaceCameraController.enableZoom to be false").toBe(false);
  });

  test("cameraOrbit (start + stop)", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    await runToolStep(page, {
      prompt:
        'Using the cameraOrbit tool with action "start", start a continuous clockwise camera orbit around the current view at speed 1.',
      toolName: "cameraOrbit",
    });

    // No result data for either action — verify the orbit is actually moving the camera, then
    // verify it actually stops, instead of only checking each call "succeeded".
    const whileOrbiting = await getViewerSnapshot(page);
    await expect
      .poll(async () => cameraDistanceMoved(whileOrbiting, await getViewerSnapshot(page)), {
        message: "expected the camera to be moving while orbiting",
        timeout: 5_000,
      })
      .toBeGreaterThan(0);

    await runToolStep(page, {
      prompt:
        'Using the cameraOrbit tool with action "stop", stop the camera orbit that is currently running.',
      toolName: "cameraOrbit",
    });

    const stopped = await getViewerSnapshot(page);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const stillStopped = await getViewerSnapshot(page);
    expect(
      cameraDistanceMoved(stopped, stillStopped),
      "expected the camera to have stopped moving after stop",
    ).toBe(0);
  });

  test("cameraLookAtTransform", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const before = await getViewerSnapshot(page);

    await runToolStep(page, {
      prompt:
        "Using Camera.lookAtTransform (not flyTo, not Camera.setView), point the camera to look at latitude 40.7128, longitude -74.0060 (New York).",
      toolName: "cameraLookAtTransform",
    });

    const after = await getViewerSnapshot(page);
    expect(
      cameraDistanceMoved(before, after),
      "expected the camera to have visibly moved after lookAtTransform",
    ).toBeGreaterThan(1);

    // No result data — verify the camera actually ended up near New York (lookAtTransform orbits
    // the target at a small offset range, so it won't sit exactly on the target's lat/lon).
    const geodetic = await getCameraGeodeticPosition(page);
    expect(geodetic.latitude).toBeCloseTo(40.7128, 0);
    expect(geodetic.longitude).toBeCloseTo(-74.006, 0);
  });

  // ---- entity tools -------------------------------------------------------------------------

  const ENTITY_ADD_POINT_PROMPT =
    'Using the entityAdd tool with type "point", add a red point entity with id "e2e-test-point" at latitude 48.8566, longitude 2.3522 (Paris).';

  /** A minimal, valid, network-free 1x1 PNG — avoids depending on a real image URL being reachable. */
  const BILLBOARD_IMAGE_DATA_URI =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  /** A small, already-verified-reachable, CORS-enabled public glTF (see execute-cesium-code-domains-live.spec.ts). */
  const MODEL_GLTF_URL =
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb";

  interface EntityAddTypeCase {
    type: string;
    id: string;
    prompt: string;
  }

  /** One case per `entityAdd` discriminated-union `type` — every field the type requires is spelled out concretely to reduce model ambiguity. */
  const ENTITY_ADD_TYPE_CASES: EntityAddTypeCase[] = [
    { type: "point", id: "e2e-test-point", prompt: ENTITY_ADD_POINT_PROMPT },
    {
      type: "billboard",
      id: "e2e-test-billboard",
      prompt:
        `Using the entityAdd tool with type "billboard", add a billboard entity with id "e2e-test-billboard" ` +
        `at latitude 48.8566, longitude 2.3522 (Paris), using this exact string as the image field, copied ` +
        `verbatim with no changes: ${BILLBOARD_IMAGE_DATA_URI}`,
    },
    {
      type: "label",
      id: "e2e-test-label",
      prompt:
        'Using the entityAdd tool with type "label", add a label entity with id "e2e-test-label" at latitude 48.8566, longitude 2.3522 (Paris) with text "E2E Test".',
    },
    {
      type: "model",
      id: "e2e-test-model",
      prompt:
        `Using the entityAdd tool with type "model", add a model entity with id "e2e-test-model" at latitude ` +
        `48.8566, longitude 2.3522 (Paris), height 0, using the glTF model at ${MODEL_GLTF_URL}, with scale ` +
        `100000 and minimumPixelSize 64.`,
    },
    {
      type: "polygon",
      id: "e2e-test-polygon",
      prompt:
        'Using the entityAdd tool with type "polygon", add a polygon entity with id "e2e-test-polygon" using these exact positions forming a small square (latitude, longitude): (48.85, 2.35), (48.86, 2.35), (48.86, 2.36), (48.85, 2.36), filled with a semi-transparent blue material.',
    },
    {
      type: "polyline",
      id: "e2e-test-polyline",
      prompt:
        'Using the entityAdd tool with type "polyline", add a polyline entity with id "e2e-test-polyline" connecting Paris (latitude 48.8566, longitude 2.3522) to London (latitude 51.5074, longitude -0.1278), with width 4 and a red material.',
    },
    {
      type: "box",
      id: "e2e-test-box",
      prompt:
        'Using the entityAdd tool with type "box", add a box entity with id "e2e-test-box" at latitude 48.8566, longitude 2.3522, height 0, with box dimensions x 400000, y 300000, z 500000, and a green material.',
    },
    {
      type: "corridor",
      id: "e2e-test-corridor",
      prompt:
        'Using the entityAdd tool with type "corridor", add a corridor entity with id "e2e-test-corridor" following these exact positions (latitude, longitude): (48.8566, 2.3522), (49.0, 2.5), (49.2, 2.8), with width 20000 and a yellow material.',
    },
    {
      type: "cylinder",
      id: "e2e-test-cylinder",
      prompt:
        'Using the entityAdd tool with type "cylinder", add a cylinder entity with id "e2e-test-cylinder" at latitude 48.8566, longitude 2.3522, with cylinder length 400000, topRadius 200000, bottomRadius 200000, and a purple material.',
    },
    {
      type: "ellipse",
      id: "e2e-test-ellipse",
      prompt:
        'Using the entityAdd tool with type "ellipse", add an ellipse entity with id "e2e-test-ellipse" at latitude 48.8566, longitude 2.3522, with ellipse semiMajorAxis 300000, semiMinorAxis 150000, and an orange material.',
    },
    {
      type: "rectangle",
      id: "e2e-test-rectangle",
      prompt:
        'Using the entityAdd tool with type "rectangle", add a rectangle entity with id "e2e-test-rectangle" with rectangle coordinates north 49.0, south 48.7, east 2.6, west 2.1, filled with a cyan material.',
    },
    {
      type: "wall",
      id: "e2e-test-wall",
      prompt:
        'Using the entityAdd tool with type "wall", add a wall entity with id "e2e-test-wall" following these exact positions (latitude, longitude): (48.8566, 2.3522), (49.0, 2.6), with maximumHeights 500000 and 500000, and a gray material.',
    },
  ];

  for (const entityAddCase of ENTITY_ADD_TYPE_CASES) {
    test(`entityAdd: ${entityAddCase.type}`, async ({ page }) => {
      test.setTimeout(3 * 60_000);

      const before = await getViewerSnapshot(page);

      const result = await runToolStep(page, {
        prompt: entityAddCase.prompt,
        toolName: "entityAdd",
      });

      expect(result.id, "expected the result to echo back the requested entity id").toBe(
        entityAddCase.id,
      );

      await expect
        .poll(async () => (await getViewerSnapshot(page)).entities, {
          message: `expected the ${entityAddCase.type} entity to be added to viewer.entities`,
          timeout: 10_000,
        })
        .toBeGreaterThan(before.entities);
    });
  }

  test("entityList", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    // Setup: entityList needs an entity to already exist — not itself asserted here.
    await runToolStep(page, { prompt: ENTITY_ADD_POINT_PROMPT, toolName: "entityAdd" });

    const result = await runToolStep(page, {
      prompt: "List every entity currently in the scene.",
      toolName: "entityList",
    });

    const entities = result.entities as Array<{ id: string; name?: string }>;
    expect(Array.isArray(entities), "expected result.entities to be an array").toBe(true);
    expect(
      entities.some((entity) => entity.id === "e2e-test-point"),
      `expected result.entities to contain "e2e-test-point", got: ${JSON.stringify(entities)}`,
    ).toBe(true);
  });

  test("entityRemove", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const before = await getViewerSnapshot(page);

    // Setup: entityRemove needs an entity to already exist — not itself asserted here.
    await runToolStep(page, { prompt: ENTITY_ADD_POINT_PROMPT, toolName: "entityAdd" });

    await expect
      .poll(async () => (await getViewerSnapshot(page)).entities, {
        message: "expected the entityAdd point to be added to viewer.entities",
        timeout: 10_000,
      })
      .toBeGreaterThan(before.entities);

    const result = await runToolStep(page, {
      prompt: 'Remove the entity with id "e2e-test-point" from the scene.',
      toolName: "entityRemove",
    });

    expect(result.id, "expected the result to echo back the removed entity id").toBe(
      "e2e-test-point",
    );

    await expect
      .poll(async () => (await getViewerSnapshot(page)).entities, {
        message: "expected the e2e-test-point entity to be removed",
        timeout: 10_000,
      })
      .toBe(before.entities);
  });

  // ---- animation tools -----------------------------------------------------------------------
  // animationCreate auto-generates its own animationId (returned in the result) — the tests below
  // that need an existing animation deliberately reference "the animation you just created"
  // instead of a literal id, relying on the model reading that id back out of the conversation
  // history, the same way a person would.

  const ANIMATION_CREATE_PROMPT =
    "Using animationCreate, create an animated entity that flies from Paris (latitude 48.8566, longitude 2.3522) at time 2026-01-01T00:00:00Z to London (latitude 51.5074, longitude -0.1278) at time 2026-01-01T00:05:00Z, using position samples.";

  test("animationCreate", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt: ANIMATION_CREATE_PROMPT,
      toolName: "animationCreate",
    });

    expect(typeof result.animationId, "expected result.animationId to be a string").toBe("string");
    const animationId = result.animationId as string;
    expect(animationId).toMatch(/^animation-/);

    // Confirm the returned id actually corresponds to a real entity in the scene.
    const entityExists = await page.evaluate(
      (id) =>
        (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E.entities.getById(
          id,
        ) !== undefined,
      animationId,
    );
    expect(entityExists, `expected an entity with id "${animationId}" to exist`).toBe(true);
  });

  test("animationListActive", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const created = await runToolStep(page, {
      prompt: ANIMATION_CREATE_PROMPT,
      toolName: "animationCreate",
    });
    const animationId = created.animationId as string;

    const result = await runToolStep(page, {
      prompt: "List every animation that is currently active.",
      toolName: "animationListActive",
    });

    const animations = result.animations as Array<{ animationId: string; name?: string }>;
    expect(Array.isArray(animations), "expected result.animations to be an array").toBe(true);
    expect(
      animations.some((animation) => animation.animationId === animationId),
      `expected result.animations to contain "${animationId}", got: ${JSON.stringify(animations)}`,
    ).toBe(true);
  });

  test("animationControl", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    await runToolStep(page, { prompt: ANIMATION_CREATE_PROMPT, toolName: "animationCreate" });

    await runToolStep(page, {
      prompt: 'Using animationControl, pause the animation you just created (action "pause").',
      toolName: "animationControl",
    });

    // No result data — verify the shared clock actually stopped animating.
    const shouldAnimate = await page.evaluate(
      () =>
        (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E.clock
          .shouldAnimate,
    );
    expect(shouldAnimate, "expected viewer.clock.shouldAnimate to be false after pause").toBe(
      false,
    );
  });

  test("animationCameraTracking", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const created = await runToolStep(page, {
      prompt: ANIMATION_CREATE_PROMPT,
      toolName: "animationCreate",
    });
    const animationId = created.animationId as string;

    await runToolStep(page, {
      prompt: "Make the camera track and follow the animation you just created.",
      toolName: "animationCameraTracking",
    });

    // No result data — verify the Viewer's trackedEntity actually points at the right entity.
    const trackedEntityId = await page.evaluate(
      () =>
        (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E.trackedEntity
          ?.id,
    );
    expect(
      trackedEntityId,
      "expected viewer.trackedEntity to be the animation entity just created",
    ).toBe(animationId);
  });

  test("animationUpdatePath", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const created = await runToolStep(page, {
      prompt: ANIMATION_CREATE_PROMPT,
      toolName: "animationCreate",
    });
    const animationId = created.animationId as string;

    await runToolStep(page, {
      prompt:
        "Using animationUpdatePath, update the path for the animation you just created so its trailing path line is 8 pixels wide.",
      toolName: "animationUpdatePath",
    });

    // No result data — verify the entity's real path graphics width was actually updated.
    const pathWidth = await page.evaluate((id) => {
      const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
      const entity = viewer.entities.getById(id);
      return entity?.path?.width?.getValue();
    }, animationId);
    expect(pathWidth, "expected the animation entity's path.width to be updated to 8").toBe(8);
  });

  test("clockControl", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    await runToolStep(page, {
      prompt:
        'Using clockControl with action "setMultiplier", speed up the simulation clock to a multiplier of 50.',
      toolName: "clockControl",
    });

    const after = await getViewerSnapshot(page);
    expect(after.clockMultiplier, "expected the clock multiplier to be set to 50").toBe(50);
  });

  test("globeSetLighting", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    await runToolStep(page, {
      prompt:
        "Using globeSetLighting, enable realistic sun/moon lighting on the globe (enableLighting true).",
      toolName: "globeSetLighting",
    });

    const after = await getViewerSnapshot(page);
    expect(after.enableLighting, "expected globe lighting to be enabled").toBe(true);
  });

  test("animationRemove", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const before = await getViewerSnapshot(page);

    const created = await runToolStep(page, {
      prompt: ANIMATION_CREATE_PROMPT,
      toolName: "animationCreate",
    });
    const animationId = created.animationId as string;

    await runToolStep(page, {
      prompt:
        "Using animationRemove, remove the animation you created earlier in this conversation.",
      toolName: "animationRemove",
    });

    // No result data — verify the specific entity by id is gone (stronger than just a count check).
    const entityStillExists = await page.evaluate(
      (id) =>
        (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E.entities.getById(
          id,
        ) !== undefined,
      animationId,
    );
    expect(entityStillExists, `expected entity "${animationId}" to no longer exist`).toBe(false);

    await expect
      .poll(async () => (await getViewerSnapshot(page)).entities, {
        message: "expected the animation entity to be removed again",
        timeout: 10_000,
      })
      .toBe(before.entities);
  });

  // ---- imagery tools -------------------------------------------------------------------------

  const IMAGERY_ADD_PROMPT =
    "Using imageryAdd, add an OpenStreetMap imagery layer as a base map (type OpenStreetMapImageryProvider, url https://tile.openstreetmap.org).";

  test("imageryAdd", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const before = await getViewerSnapshot(page);

    const result = await runToolStep(page, { prompt: IMAGERY_ADD_PROMPT, toolName: "imageryAdd" });

    // The model typically supplies its own descriptive `name` (e.g. "OpenStreetMap Base Map")
    // rather than leaving it blank, so assert structure/type here, not a specific hardcoded value.
    expect(typeof result.name, "expected result.name to be a string").toBe("string");
    expect((result.name as string).length, "expected result.name to be non-empty").toBeGreaterThan(
      0,
    );
    expect(typeof result.index, "expected result.index to be a number").toBe("number");
    expect(result.index as number).toBeGreaterThanOrEqual(0);

    await expect
      .poll(async () => (await getViewerSnapshot(page)).imageryLayers, {
        message: "expected the OSM imagery layer to be added",
        timeout: 10_000,
      })
      .toBeGreaterThan(before.imageryLayers);
  });

  test("imageryList", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const added = await runToolStep(page, { prompt: IMAGERY_ADD_PROMPT, toolName: "imageryAdd" });
    const addedName = added.name as string;

    const result = await runToolStep(page, {
      prompt: "List every imagery layer currently on the globe.",
      toolName: "imageryList",
    });

    const layers = result.layers as Array<{ index: number; name: string; show: boolean }>;
    expect(Array.isArray(layers), "expected result.layers to be an array").toBe(true);
    // Look up by the exact name imageryAdd's own result reported back, rather than assuming a
    // specific default name (the model chooses its own descriptive name — see imageryAdd's test).
    const osmLayer = layers.find((layer) => layer.name === addedName);
    expect(
      osmLayer,
      `expected result.layers to contain "${addedName}", got: ${JSON.stringify(layers)}`,
    ).toBeDefined();
    expect(osmLayer?.show).toBe(true);
  });

  test("imageryRemove", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    const before = await getViewerSnapshot(page);

    await runToolStep(page, { prompt: IMAGERY_ADD_PROMPT, toolName: "imageryAdd" });

    await expect
      .poll(async () => (await getViewerSnapshot(page)).imageryLayers, {
        message: "expected the OSM imagery layer to be added",
        timeout: 10_000,
      })
      .toBeGreaterThan(before.imageryLayers);

    await runToolStep(page, {
      prompt: "Using imageryRemove, remove all imagery layers from the globe (removeAll true).",
      toolName: "imageryRemove",
    });

    // removeAll drains every layer, including whatever base imagery the app ships with by
    // default — not just the one added above — so the expected end state is always 0, not
    // `before.imageryLayers`.
    await expect
      .poll(async () => (await getViewerSnapshot(page)).imageryLayers, {
        message: "expected all imagery layers to be removed",
        timeout: 10_000,
      })
      .toBe(0);
  });

  // ---- flyTo ----------------------------------------------------------------------------------

  /**
   * `flyToLocation` resolves `{ success: true }` only after `viewer.camera.flyTo`'s `complete`
   * callback fires, which requires a real animating Viewer — so the rendered success result is
   * itself evidence the live globe actually flew.
   */
  test("flyTo", async ({ page }) => {
    test.setTimeout(2 * 60_000);

    const input = page.locator(INPUT_SELECTOR);
    await input.fill("Fly to Paris");
    await input.press("Enter");

    await expect(
      page.getByText(new RegExp(`\\[tool\\]\\s*flyTo\\b`)).last(),
      'expected the model to call flyTo for prompt: "Fly to Paris"',
    ).toBeVisible({ timeout: 90_000 });

    const toolCard = await expandToolCard(page, "flyTo");

    // Args are still rendered as real JSON (`JSON.stringify(invocation.args)`), unlike the result
    // below — Paris is ~48.86 N, ~2.35 E, allow slack for however the model rounds.
    const argsBlock = toolCard.locator('pre[class*="toolArgs"]');
    await expect(argsBlock).toBeVisible({ timeout: 10_000 });
    const args = JSON.parse((await argsBlock.textContent()) ?? "{}");
    expect(args.latitude).toBeGreaterThan(48);
    expect(args.latitude).toBeLessThan(50);
    expect(args.longitude).toBeGreaterThan(1.5);
    expect(args.longitude).toBeLessThan(3.5);

    const resultBlock = toolCard.locator('pre[class*="toolResult"]');
    await expect(resultBlock).toBeVisible({ timeout: 20_000 });
    const result = JSON.parse((await resultBlock.textContent()) ?? "{}");
    expect(result.success).toBe(true);

    await expect(
      page.locator('[data-testid="error-text"]'),
      'backend/tool reported an error after: "Fly to Paris"',
    ).toHaveCount(0);
  });
});
