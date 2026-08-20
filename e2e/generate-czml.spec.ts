import { test, expect, type Page } from "@playwright/test";
import { expandToolCard } from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Deterministic, stubbed coverage of the `generateCzml` tool's result-handling edge cases (see
 * `generate-czml-live.spec.ts` for the real intent -> generation -> verification pipeline against
 * the live backend/model, which can't reliably reproduce these specific outcomes on demand).
 *
 * `/api/chat` is mocked with a canned AI SDK UI message stream carrying a `tool-output-available`
 * chunk for `generateCzml` (same wire shape `ChatClient.parseStream` handles for a real backend —
 * see `packages/chat-element/src/chat-client/chat-client.ts`), so no real model/backend call
 * happens. What IS real: the browser's `CesiumGlobe`, its live `Viewer`, and the real
 * `CzmlDataSource.load()` call `frontend/src/tools/generate-czml.ts` makes — these tests prove the
 * app's actual load-into-Viewer wiring works, not just the pure functions already covered by
 * `frontend/src/tools/generate-czml.test.ts`'s `fakeViewer()`.
 *
 * `generateCzml` is not `needsApproval`-gated (see `ChatPanel.tsx`), and its result renders as a
 * plain JSON `pre[class*="toolResult"]` (no dedicated code/error panel — `codeResultToolName` is
 * only set for `executeCesiumCode`), so all three outcomes below are read the same way.
 */

const VALID_CZML = [
  { id: "document", version: "1.0" },
  { id: "pt-1", position: { cartographicDegrees: [0, 0, 0] }, point: { pixelSize: 8 } },
];

interface ViewerSnapshot {
  dataSources: number;
}

async function getViewerSnapshot(page: Page): Promise<ViewerSnapshot> {
  return page.evaluate(() => {
    const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
    if (!viewer) {
      throw new Error(
        "window.__cesiumViewerForE2E is undefined — is the app running in dev mode " +
          "(`npm run dev:frontend`), and has CesiumGlobe finished mounting?",
      );
    }
    return { dataSources: viewer.dataSources.length };
  });
}

/**
 * Mocks a single conversational turn where the model calls `generateCzml` and the server
 * resolves it with `output`. `onServerToolResult` always requests a follow-up request
 * (`continueConversation: true` — see `ChatPanel.tsx`'s doc comment), so a second, distinct
 * response is queued for that continuation: a bare `finish` with no further tool call, to avoid
 * looping back into another `generateCzml` invocation.
 */
async function mockGenerateCzmlTurn(page: Page, output: Record<string, unknown>) {
  const sseBody = (chunks: Array<Record<string, unknown>>) =>
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n`).join("") + "data: [DONE]\n";

  const responses = [
    sseBody([
      {
        type: "tool-input-available",
        toolCallId: "call-czml-1",
        toolName: "generateCzml",
        input: { intent: "Add a marker using CZML" },
      },
      { type: "tool-output-available", toolCallId: "call-czml-1", output },
      { type: "finish" },
    ]),
    sseBody([{ type: "finish" }]),
  ];

  let callCount = 0;
  await page.route("**/api/chat", (route) => {
    const body = responses[Math.min(callCount, responses.length - 1)];
    callCount += 1;
    route.fulfill({ status: 200, contentType: "text/event-stream", body });
  });
}

/** Navigates fresh and waits for the chat input to be ready, without submitting anything yet. */
async function gotoAndWaitForInput(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });
}

/** Submits the standard prompt and returns the settled `generateCzml` tool card's JSON result. */
async function submitAndReadGenerateCzmlResult(page: Page): Promise<Record<string, unknown>> {
  await page.locator(INPUT_SELECTOR).fill("Add a marker using CZML");
  await page.locator(INPUT_SELECTOR).press("Enter");

  await expect(page.getByText(/\[tool\]\s*generateCzml/)).toBeVisible({ timeout: 10_000 });
  const toolCard = await expandToolCard(page, "generateCzml");
  const resultBlock = toolCard.locator('pre[class*="toolResult"]');
  await expect(resultBlock).toBeVisible({ timeout: 10_000 });

  return JSON.parse((await resultBlock.textContent()) ?? "{}") as Record<string, unknown>;
}

test.describe("generateCzml tool — stubbed result handling", () => {
  test("a verified CZML document loads into the live Viewer via a real CzmlDataSource", async ({
    page,
  }) => {
    await mockGenerateCzmlTurn(page, { czml: VALID_CZML, description: "one marker" });
    await gotoAndWaitForInput(page);
    const before = await getViewerSnapshot(page);

    const result = await submitAndReadGenerateCzmlResult(page);

    expect(result.description).toBe("one marker");
    expect(result.entityCount).toBe(1);
    expect(result.error).toBeUndefined();

    const after = await getViewerSnapshot(page);
    expect(after.dataSources).toBe(before.dataSources + 1);

    const loadedEntityCount = await page.evaluate(() => {
      const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
      return viewer.dataSources.get(viewer.dataSources.length - 1).entities.values.length;
    });
    expect(loadedEntityCount).toBe(1);

    await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);
  });

  test("a verification-failure result reports the tool's own error and touches nothing in the Viewer", async ({
    page,
  }) => {
    await mockGenerateCzmlTurn(page, {
      error: "Generated CZML failed verification after all attempts.",
    });
    await gotoAndWaitForInput(page);
    const before = await getViewerSnapshot(page);

    const result = await submitAndReadGenerateCzmlResult(page);

    expect(result.error).toBe("Generated CZML failed verification after all attempts.");
    const after = await getViewerSnapshot(page);
    expect(after.dataSources).toBe(before.dataSources);
    await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);
  });

  test("a malformed result (matches neither success nor error shape) is reported without touching the Viewer", async ({
    page,
  }) => {
    await mockGenerateCzmlTurn(page, {});
    await gotoAndWaitForInput(page);
    const before = await getViewerSnapshot(page);

    const result = await submitAndReadGenerateCzmlResult(page);

    expect(result.error).toBe("Malformed generateCzml result.");
    const after = await getViewerSnapshot(page);
    expect(after.dataSources).toBe(before.dataSources);
    await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);
  });
});
