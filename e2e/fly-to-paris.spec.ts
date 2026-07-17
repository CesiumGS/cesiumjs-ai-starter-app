import { test, expect } from "@playwright/test";
import { expandToolCard } from "./helpers/tool-card";

// Native <input> inside the chat input wrapper (MUI wraps it in an outer div).
const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

/**
 * Real end-to-end test for the `flyTo` tool.
 *
 * Unlike the styling specs, this one does **not** mock `/api/chat`: the prompt
 * goes to the real model running on the ALREADY-RUNNING backend, the model calls
 * the `flyTo` tool, the browser executes that call against the live CesiumJS
 * Viewer (`flyToLocation`), and the `{ success: true }` result is posted back and
 * rendered in the transcript. We assert on that rendered tool call + result.
 *
 * Because the backend turn is real, the env must be configured before running:
 *   - a supported provider API key (so the model responds), and
 *   - VITE_CESIUM_ION_ACCESS_TOKEN (so the Viewer + terrain initialise).
 *
 * How to run (two terminals):
 *   1) npm run dev:backend     # backend on :3001 with .env loaded
 *   2) npm run test:e2e        # Playwright starts the frontend on :5173 and runs this
 *
 * `flyToLocation` resolves `{ success: true }` only after `viewer.camera.flyTo`'s
 * `complete` callback fires, which requires a real animating Viewer — so the
 * rendered success result is itself evidence the live globe actually flew.
 */
test.describe("flyTo tool — end-to-end against the live backend", () => {
  test("'Fly to Paris' invokes the flyTo tool in the browser and returns success", async ({
    page,
  }) => {
    // Generous budget: real model turn -> tool call -> camera flight -> follow-up turn.
    test.setTimeout(120_000);

    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30_000 });

    // 1. Type the prompt and send it.
    const input = page.locator(INPUT_SELECTOR);
    await input.fill("Fly to Paris");
    await input.press("Enter");

    // The user's message echoes into the transcript immediately.
    await expect(page.locator('[data-testid="user-bubble"]').first()).toHaveText(/Fly to Paris/i, {
      timeout: 5_000,
    });

    // Fail fast with a clear signal if the backend isn't configured (no API key,
    // wrong endpoint, etc.) instead of timing out waiting for a tool call.
    await expect(
      page.locator('[data-testid="error-text"]'),
      "backend returned an error — is the server running with a valid provider API key?",
    ).toHaveCount(0);

    // 2. The model calls the `flyTo` tool — its card appears in the transcript.
    await expect(page.getByText(/\[tool\]\s*flyTo/)).toBeVisible({ timeout: 90_000 });

    // Force the tool card open — `MessageItem.tsx`'s `ToolCard` auto-collapses once resolved if
    // its combined args/result text exceeds a length threshold, which would otherwise hide the
    // <pre> blocks below from Playwright's visibility checks (see `expandToolCard`'s doc comment).
    const toolCard = await expandToolCard(page, "flyTo");

    // 3. The tool was driven with Paris coordinates (model-resolved lat/lon). Args are still
    //    rendered as real JSON (`JSON.stringify(invocation.args)`), unlike the result below.
    const argsBlock = toolCard.locator('pre[class*="toolArgs"]');
    await expect(argsBlock).toBeVisible({ timeout: 10_000 });

    const args = JSON.parse((await argsBlock.textContent()) ?? "{}");
    // Paris is ~48.86 N, ~2.35 E. Allow slack for however the model rounds.
    expect(args.latitude).toBeGreaterThan(48);
    expect(args.latitude).toBeLessThan(50);
    expect(args.longitude).toBeGreaterThan(1.5);
    expect(args.longitude).toBeLessThan(3.5);

    // 4. The browser ran the tool against the live Viewer and posted the result back:
    //    `{ success: true }`. `formatToolPayload` (MessageItem.tsx) renders non-string fields as
    //    plain `key: value` text (not JSON), so this reads the boolean directly instead of
    //    `JSON.parse`-ing the <pre> text. The result <pre> only appears once the camera flight
    //    completes, so this confirms the end-to-end round trip.
    const resultBlock = toolCard.locator('pre[class*="toolResult"]');
    await expect(resultBlock).toBeVisible({ timeout: 20_000 });

    const resultText = (await resultBlock.textContent()) ?? "";
    expect(resultText).toMatch(/(?:^|\n)success:\s*true/);
  });
});
