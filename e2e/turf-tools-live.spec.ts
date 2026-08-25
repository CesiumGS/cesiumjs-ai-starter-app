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
