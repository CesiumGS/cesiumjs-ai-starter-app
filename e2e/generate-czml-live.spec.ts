import { test, expect, type Page } from "@playwright/test";
import { expandToolCard } from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end test for the `generateCzml` tool — the genuine intent -> skill-grounded
 * generation -> `CzmlDataSource`-based verification -> load pipeline, not a stubbed result (see
 * `generate-czml.spec.ts` for the deterministic, stubbed scenarios covering the
 * success/verification-failure/malformed-result edge cases this real pipeline can't reliably
 * reproduce on demand).
 *
 * Unlike `executeCesiumCode`, `generateCzml` is NOT `needsApproval`-gated (loading an
 * already-verified CZML document is declarative data, not arbitrary code execution — see
 * `ChatPanel.tsx`'s doc comment on `handleServerToolResult`), so this test never clicks Approve;
 * the tool card resolves straight to a result.
 *
 * Requires the same setup as `cesium-viewer-tools-live.spec.ts`:
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * The model's generated CZML may or may not pass the real verifier — both are legitimate,
 * assertable outcomes here (the verifier itself is what this test exercises), so this asserts the
 * shape of whichever result comes back rather than requiring success. When verification does
 * pass, the browser loads the document into the live `Viewer` via a real `CzmlDataSource`.
 */

interface ViewerSnapshot {
  dataSources: number;
  entities: number;
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
    return {
      dataSources: viewer.dataSources.length,
      entities: viewer.entities.values.length,
    };
  });
}

test.describe("generateCzml tool — end-to-end against the live backend", () => {
  test("a time-dynamic scene intent is verified (or rejected) and, if verified, loads into the live Viewer", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });

    const before = await getViewerSnapshot(page);

    const input = page.locator(INPUT_SELECTOR);
    await input.fill(
      "Create a time-dynamic scene of a satellite orbiting Earth once every 90 minutes over " +
        "the next 3 hours, using CZML generation — not entityAdd and not raw CesiumJS code.",
    );
    await input.press("Enter");

    await expect(page.locator('[data-testid="user-bubble"]').first()).toHaveText(/satellite/i, {
      timeout: 5_000,
    });

    // Fail fast with a clear signal if the backend isn't configured, instead of timing out
    // waiting for a tool call.
    await expect(
      page.locator('[data-testid="error-text"]'),
      "backend returned an error — is the server running with a valid provider API key?",
    ).toHaveCount(0);

    // No approval gate for generateCzml — the tool card goes straight from pending to a
    // settled result once the server finishes generation + verification.
    await expect(page.getByText(/\[tool\]\s*generateCzml/)).toBeVisible({ timeout: 90_000 });

    const toolCard = await expandToolCard(page, "generateCzml");
    const resultBlock = toolCard.locator('pre[class*="toolResult"]');
    await expect(resultBlock).toBeVisible({ timeout: 60_000 });

    const result = JSON.parse((await resultBlock.textContent()) ?? "{}") as Record<string, unknown>;

    if (typeof result.error === "string") {
      // The generated CZML was rejected by the real verifier (or generation itself failed) — a
      // legitimate outcome for this test: the gate did its job and nothing loaded into the Viewer.
      const after = await getViewerSnapshot(page);
      expect(after.dataSources).toBe(before.dataSources);
    } else {
      // Verified and loaded: the document carries a real entity count, and the live Viewer
      // actually gained a data source with that many entities — proves this isn't just "no
      // error was shown", the CZML genuinely executed against the real Viewer.
      expect(Array.isArray(result.czml)).toBe(true);
      expect(typeof result.description).toBe("string");
      expect(typeof result.entityCount).toBe("number");
      expect(result.entityCount as number).toBeGreaterThan(0);

      await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);

      const after = await getViewerSnapshot(page);
      expect(after.dataSources).toBe(before.dataSources + 1);

      const loadedEntities = await page.evaluate(() => {
        const viewer = (window as unknown as { __cesiumViewerForE2E?: any }).__cesiumViewerForE2E;
        const lastDataSource = viewer.dataSources.get(viewer.dataSources.length - 1);
        return lastDataSource.entities.values.length;
      });
      expect(loadedEntities).toBe(result.entityCount);
    }

    expect(pageErrors).toHaveLength(0);
  });
});
