import { test, expect, type Page } from "@playwright/test";
import { expandToolCard } from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end coverage of every `@cesium-ai/turf-tools` server tool
 * (`turf_register_dataset`, `turf_buffer`, `turf_points_within_polygon`, `turf_intersect`,
 * `turf_area`, `turf_hex_grid`, `turf_get_dataset`) — enabled by default via
 * `ENABLE_TURF_TOOLS` (see `backend/src/utils/env.ts`).
 *
 * Like `cesium-viewer-tools-live.spec.ts`, this does **not** mock `/api/chat`: prompts go to the
 * real model on the ALREADY-RUNNING backend. Unlike the viewer tools, Turf tools never touch the
 * live CesiumJS `Viewer` — they only read/write the server-side, per-session dataset store — so
 * these tests assert purely on each tool card's JSON result, not on any `window.__cesiumViewerForE2E`
 * state.
 *
 * The dataset store is keyed by Express session cookie, which the browser retains automatically
 * across requests on the same page — so a `dataset_id` returned by one prompt in a test can be
 * referenced by a later prompt in the SAME test (`test.describe.serial` is not needed since each
 * test uses its own fresh page/session via `beforeEach`'s `page.goto("/")`).
 *
 * How to run (two terminals):
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 */

/** One conversational turn: a prompt expected to invoke exactly `toolName`. */
interface ToolStep {
  prompt: string;
  toolName: string;
}

/**
 * Submits `step.prompt`, waits for `step.toolName`'s tool card to appear with a settled result,
 * and returns the result `<pre>`'s content parsed as JSON. Mirrors `cesium-viewer-tools-live.spec.ts`'s
 * `runToolStep`, minus the `success: true` assertion — Turf tool results carry no `success` field,
 * just their own data shape (`dataset_id`, `area`, `error`, ...).
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
  expect(result.error, `expected ${step.toolName}'s result to carry no error`).toBeUndefined();

  return result;
}

test.describe("Turf.js tools — end-to-end against the live backend", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });
  });

  test("turf_register_dataset", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_register_dataset tool, register this GeoJSON polygon so I can reference " +
        'it later: {"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":' +
        "[[[-0.5,51.3],[0.2,51.3],[0.2,51.7],[-0.5,51.7],[-0.5,51.3]]]}} (a rough box around London).",
      toolName: "turf_register_dataset",
    });

    expect(typeof result.dataset_id).toBe("string");
    expect((result.dataset_id as string).length).toBeGreaterThan(0);
  });

  test("turf_area", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_area tool, compute the area in square_kilometers of this GeoJSON polygon " +
        '(do not register it first, pass it directly): {"type":"Feature","properties":{},' +
        '"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}}',
      toolName: "turf_area",
    });

    expect(typeof result.area).toBe("number");
    expect(result.area as number).toBeGreaterThan(0);
    expect(result.units).toBe("square_kilometers");
  });

  test("turf_buffer", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_buffer tool, buffer this GeoJSON point by 500 meters (do not register it " +
        'first, pass it directly): {"type":"Feature","properties":{},"geometry":{"type":"Point",' +
        '"coordinates":[-0.1278,51.5074]}}',
      toolName: "turf_buffer",
    });

    expect(typeof result.dataset_id).toBe("string");
    expect(result.feature_count).toBe(1);
  });

  test("turf_points_within_polygon", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_points_within_polygon tool, find which of these points fall inside this " +
        "polygon (pass both directly, do not register them first). Points (FeatureCollection): " +
        '{"type":"FeatureCollection","features":[' +
        '{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[0.5,0.5]}},' +
        '{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[5,5]}}]}. ' +
        'Polygon: {"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":' +
        "[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}}",
      toolName: "turf_points_within_polygon",
    });

    expect(typeof result.dataset_id).toBe("string");
    expect(result.point_count).toBe(1);
  });

  test("turf_intersect", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_intersect tool, compute the overlap between these two polygon " +
        "FeatureCollections (pass both directly, do not register them first). " +
        'features1: {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},' +
        '"geometry":{"type":"Polygon","coordinates":[[[0,0],[2,0],[2,2],[0,2],[0,0]]]}}]}. ' +
        'features2: {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},' +
        '"geometry":{"type":"Polygon","coordinates":[[[1,1],[3,1],[3,3],[1,3],[1,1]]]}}]}',
      toolName: "turf_intersect",
    });

    expect(typeof result.dataset_id).toBe("string");
    expect(result.overlap_count).toBe(1);
  });

  test("turf_hex_grid", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const result = await runToolStep(page, {
      prompt:
        "Using the turf_hex_grid tool, generate a hexagonal grid (no point aggregation) over the " +
        "bounding box west -0.5, south 51.3, east 0.2, north 51.7, with a cell side of 5 kilometers.",
      toolName: "turf_hex_grid",
    });

    expect(typeof result.dataset_id).toBe("string");
    expect(typeof result.cell_count).toBe("number");
    expect(result.cell_count as number).toBeGreaterThan(0);
  });

  test("turf_get_dataset (chained after turf_register_dataset)", async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const registered = await runToolStep(page, {
      prompt:
        "Using the turf_register_dataset tool, register this GeoJSON point: " +
        '{"type":"Feature","properties":{"name":"test-point"},"geometry":{"type":"Point",' +
        '"coordinates":[-0.1278,51.5074]}}',
      toolName: "turf_register_dataset",
    });
    const datasetId = registered.dataset_id as string;
    expect(typeof datasetId).toBe("string");

    const result = await runToolStep(page, {
      prompt: `Using the turf_get_dataset tool, fetch the full GeoJSON for dataset_id "${datasetId}".`,
      toolName: "turf_get_dataset",
    });

    expect(result.geojson).toBeTruthy();
    const geojson = result.geojson as { properties?: { name?: string } };
    expect(geojson.properties?.name).toBe("test-point");
  });
});

/**
 * Regression coverage for a real bug: `geoJsonAdd` (a client-side `@cesium-ai/tools-schemas` tool,
 * not a Turf tool) crashed with an opaque "Cannot read properties of undefined (reading 'length')"
 * when the model passed it a structurally-loose GeoJSON object missing `features`/`geometry` —
 * exactly the shape a model can end up constructing when relaying a Turf tool's dataset back out
 * (see `packages/tools-schemas/src/tools/geoJsonAdd/geoJsonAdd.schema.ts`'s fix and this repo's
 * `resolve-geojson.ts` for the identical, earlier-fixed bug class in Turf tools themselves).
 *
 * These tests exercise the full real-world chain this app is meant to support end-to-end against
 * the live backend AND the live CesiumJS `Viewer` (unlike the tests above, which only assert on
 * tool-result JSON): a Turf tool produces/stores a dataset, `turf_get_dataset` fetches its full
 * GeoJSON back into the conversation, and `geoJsonAdd` renders that GeoJSON on the globe. Viewer
 * state is read via the dev-only `window.__cesiumViewerForE2E` seam, same convention as
 * `cesium-viewer-tools-live.spec.ts`.
 */
test.describe("Turf.js output rendered on the globe via geoJsonAdd", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });
  });

  async function getDataSourceCount(page: Page): Promise<number> {
    return page.evaluate(() => {
      const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
      if (!viewer) {
        throw new Error(
          "window.__cesiumViewerForE2E is undefined — is the app running in dev mode " +
            "(`npm run dev:frontend`), and has CesiumGlobe finished mounting?",
        );
      }
      return viewer.dataSources.length as number;
    });
  }

  test("turf_buffer dataset -> turf_get_dataset -> geoJsonAdd renders a new data source", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);

    const before = await getDataSourceCount(page);

    const buffered = await runToolStep(page, {
      prompt:
        "Using the turf_buffer tool, buffer this GeoJSON point by 500 meters (do not register it " +
        'first, pass it directly): {"type":"Feature","properties":{},"geometry":{"type":"Point",' +
        '"coordinates":[-0.1278,51.5074]}}',
      toolName: "turf_buffer",
    });
    const datasetId = buffered.dataset_id as string;
    expect(typeof datasetId).toBe("string");

    await runToolStep(page, {
      prompt: `Using the turf_get_dataset tool, fetch the full GeoJSON for dataset_id "${datasetId}".`,
      toolName: "turf_get_dataset",
    });

    const rendered = await runToolStep(page, {
      prompt:
        "Now using the geoJsonAdd tool, render the exact GeoJSON returned by the previous " +
        'turf_get_dataset call on the globe. Name it "turf-buffer-zone" and use a red stroke color.',
      toolName: "geoJsonAdd",
    });

    expect(rendered.success).toBe(true);
    expect(rendered.name).toBe("turf-buffer-zone");
    expect(typeof rendered.entityCount).toBe("number");
    expect(rendered.entityCount as number).toBeGreaterThan(0);

    const after = await getDataSourceCount(page);
    expect(after).toBe(before + 1);
  });

  test("turf_hex_grid dataset -> turf_get_dataset -> geoJsonAdd renders a new data source", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);

    const before = await getDataSourceCount(page);

    const hexGrid = await runToolStep(page, {
      prompt:
        "Using the turf_hex_grid tool, generate a hexagonal grid (no point aggregation) over the " +
        "bounding box west -0.5, south 51.3, east 0.2, north 51.7, with a cell side of 5 kilometers.",
      toolName: "turf_hex_grid",
    });
    const datasetId = hexGrid.dataset_id as string;
    expect(typeof datasetId).toBe("string");

    await runToolStep(page, {
      prompt: `Using the turf_get_dataset tool, fetch the full GeoJSON for dataset_id "${datasetId}".`,
      toolName: "turf_get_dataset",
    });

    const rendered = await runToolStep(page, {
      prompt:
        "Now using the geoJsonAdd tool, render the exact GeoJSON returned by the previous " +
        'turf_get_dataset call on the globe. Name it "turf-hex-grid".',
      toolName: "geoJsonAdd",
    });

    expect(rendered.success).toBe(true);
    expect(rendered.name).toBe("turf-hex-grid");
    expect(typeof rendered.entityCount).toBe("number");
    expect(rendered.entityCount as number).toBeGreaterThan(0);

    const after = await getDataSourceCount(page);
    expect(after).toBe(before + 1);
  });
});
