import { test, expect } from "@playwright/test";

const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

// Abort the backend so tests run without a real API and the user bubble
// still appears immediately (client.submit() pushes the user message before
// the fetch call, so the bubble is in the DOM even if the request fails).
test.beforeEach(async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({ status: 200, body: "" }));
  await page.goto("/");
  await page.waitForSelector(INPUT_SELECTOR, { timeout: 30000 });
});

async function sendMessage(page: import("@playwright/test").Page, text: string) {
  await page.locator(INPUT_SELECTOR).fill(text);
  await page.locator(INPUT_SELECTOR).press("Enter");
  await expect(page.locator('[data-testid="user-bubble"]').first()).toBeVisible({ timeout: 5000 });
}

test.describe("MessageItem — user bubble spacing", () => {
  test("bubble has horizontal padding between text and border", async ({ page }) => {
    await sendMessage(page, "fly to Tokyo");

    const bubble = page.locator('[data-testid="user-bubble"]').first();

    const paddingLeft = await bubble.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingLeft),
    );
    const paddingRight = await bubble.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingRight),
    );

    expect(paddingLeft).toBeGreaterThanOrEqual(12);
    expect(paddingRight).toBeGreaterThanOrEqual(12);
  });

  test("bubble has vertical padding between text and border", async ({ page }) => {
    await sendMessage(page, "fly to Tokyo");

    const bubble = page.locator('[data-testid="user-bubble"]').first();

    const paddingTop = await bubble.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingTop),
    );
    const paddingBottom = await bubble.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom),
    );

    expect(paddingTop).toBeGreaterThanOrEqual(8);
    expect(paddingBottom).toBeGreaterThanOrEqual(8);
  });

  test("bubble has a visible border", async ({ page }) => {
    await sendMessage(page, "fly to Tokyo");

    const bubble = page.locator('[data-testid="user-bubble"]').first();

    const borderStyle = await bubble.evaluate((el) => window.getComputedStyle(el).borderStyle);
    const borderWidth = await bubble.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).borderWidth),
    );

    expect(borderStyle).not.toBe("none");
    expect(borderWidth).toBeGreaterThanOrEqual(1);
  });

  test("bubble text does not touch the border (bounding box check)", async ({ page }) => {
    await sendMessage(page, "fly to Tokyo");

    const bubble = page.locator('[data-testid="user-bubble"]').first();

    // Measure how far the rendered text is inset from each edge of the bubble.
    // A Range over the text content gives the real glyph box; comparing it to the
    // bubble's own box proves the text never touches the border. This is
    // deterministic — unlike a pixel screenshot, it doesn't flake over the live
    // WebGL globe repainting behind the panel.
    const insets = await bubble.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      return {
        left: text.left - box.left,
        right: box.right - text.right,
        top: text.top - box.top,
        bottom: box.bottom - text.bottom,
      };
    });

    // Padding is 8px vertical / 12px horizontal (plus a 1px border on top).
    expect(insets.left).toBeGreaterThanOrEqual(12);
    expect(insets.right).toBeGreaterThanOrEqual(12);
    expect(insets.top).toBeGreaterThanOrEqual(8);
    expect(insets.bottom).toBeGreaterThanOrEqual(8);
  });

  test("multiple messages each render their own bubble", async ({ page }) => {
    await page.locator(INPUT_SELECTOR).fill("first message");
    await page.locator(INPUT_SELECTOR).press("Enter");
    await expect(page.locator('[data-testid="user-bubble"]')).toHaveCount(1, { timeout: 5000 });

    await page.locator(INPUT_SELECTOR).fill("second message");
    await page.locator(INPUT_SELECTOR).press("Enter");
    await expect(page.locator('[data-testid="user-bubble"]')).toHaveCount(2, { timeout: 5000 });

    // Both bubbles must have padding
    for (const bubble of await page.locator('[data-testid="user-bubble"]').all()) {
      const paddingLeft = await bubble.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).paddingLeft),
      );
      expect(paddingLeft).toBeGreaterThanOrEqual(12);
    }
  });
});

test.describe("MessageItem — message-item wrapper", () => {
  test("submitted message is rendered as a message-item", async ({ page }) => {
    await sendMessage(page, "hello world");

    const item = page.locator('[data-testid="message-item"][data-role="user"]').first();
    await expect(item).toBeVisible();
  });

  test("message-item wrapper has gap between sender label and bubble", async ({ page }) => {
    await sendMessage(page, "hello world");

    const item = page.locator('[data-testid="message-item"]').first();

    // The .message class uses flex + gap: 0.3rem (~4.8px)
    const gap = await item.evaluate((el) => parseFloat(window.getComputedStyle(el).gap));

    expect(gap).toBeGreaterThanOrEqual(4);
  });
});
