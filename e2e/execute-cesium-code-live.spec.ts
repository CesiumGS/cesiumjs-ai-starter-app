import { test, expect } from "@playwright/test";
import { expandToolCard, readExecuteCesiumCodeResult } from "./helpers/tool-card";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end test for the `executeCesiumCode` tool — the genuine
 * intent -> skill-matching -> prompt-building -> model generation -> AST
 * verification -> approval -> execution pipeline, not a stubbed result (see
 * `execute-cesium-code.spec.ts` for the deterministic, stubbed scenarios that
 * cover verification-failure/runtime-failure/decline edge cases this real
 * pipeline can't reliably reproduce on demand).
 *
 * Requires the same setup as `fly-to-paris.spec.ts`:
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * The model's generated snippet may or may not pass the real AST verifier —
 * both are legitimate, assertable outcomes here (the verifier itself is what
 * this test exercises), so this asserts the shape of whichever result comes
 * back rather than requiring success. When verification does pass, the
 * approved code executes against the live Viewer with no crash and no error
 * surfaced back to the transcript.
 */
test.describe("executeCesiumCode tool — end-to-end against the live backend", () => {
  test("a code-generation intent is verified (or rejected) and, if verified, runs cleanly", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });

    const input = page.locator(INPUT_SELECTOR);
    await input.fill("Add a small red point marker over Paris using CesiumJS code");
    await input.press("Enter");

    await expect(page.locator('[data-testid="user-bubble"]').first()).toHaveText(/Paris/i, {
      timeout: 5_000,
    });

    // Fail fast with a clear signal if the backend isn't configured, instead
    // of timing out waiting for a tool call.
    await expect(
      page.locator('[data-testid="error-text"]'),
      "backend returned an error — is the server running with a valid provider API key?",
    ).toHaveCount(0);

    // The model calls executeCesiumCode — its card appears, paused for
    // approval (the tool is `needsApproval`-gated; nothing has generated
    // real code yet).
    await expect(page.getByText(/\[tool\]\s*executeCesiumCode/)).toBeVisible({ timeout: 90_000 });

    // Approve the intent — only now does the server run the real
    // generation + AST-verification pipeline.
    await page.getByRole("button", { name: "Approve" }).click();

    // Force the tool card open — `MessageItem.tsx`'s `ToolCard` auto-collapses once resolved if
    // its combined args/result text exceeds a length threshold, which real generated code
    // routinely does, hiding the result <pre>s below from Playwright's visibility checks.
    const toolCard = await expandToolCard(page, "executeCesiumCode");

    const codeBlock = toolCard.locator('pre[class*="codeBlock"]');
    const resultInfoBlock = toolCard.locator('pre[class*="toolResult"]');
    await expect(codeBlock.or(resultInfoBlock)).toBeVisible({ timeout: 60_000 });

    const result = await readExecuteCesiumCodeResult(toolCard);

    if (result.error !== undefined) {
      // The generated snippet was rejected by the real AST verifier (or
      // generation itself failed) — a legitimate outcome for this test: the
      // gate did its job and nothing executed against the Viewer.
      expect(typeof result.error).toBe("string");
    } else {
      // Verified: the code ran against the live Viewer with no runtime
      // failure surfaced back to the transcript and no page crash.
      expect(result.hasCode).toBe(true);
      await expect(page.locator('[data-testid="error-text"]')).toHaveCount(0);
    }

    expect(pageErrors).toHaveLength(0);
  });
});
