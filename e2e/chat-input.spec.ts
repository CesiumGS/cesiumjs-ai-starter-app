import { test, expect } from "@playwright/test";

// Target the native <input> inside the wrapper div, not MUI's outer div
const INPUT_SELECTOR = '[data-testid="chat-input-wrapper"] input';

test.describe("Chat input styling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30000 });
  });

  // ── Border colour ───────────────────────────────────────────────────────────
  // The panel no longer overrides StrataKit tokens, so these assert against the
  // live token values rather than hardcoded colors from a removed app theme.

  test("input root has no visible border of its own (idle state)", async ({ page }) => {
    // The MuiOutlinedInput-root wrapper div should not carry its own visible border
    const rootBorderStyle = await page
      .locator(".MuiOutlinedInput-root")
      .first()
      .evaluate((el) => window.getComputedStyle(el).borderStyle);

    expect(rootBorderStyle).toBe("none");
  });

  test("input notched outline matches the default textbox border token when idle", async ({
    page,
  }) => {
    const fieldset = page.locator(".MuiOutlinedInput-notchedOutline").first();

    const borderColor = await fieldset.evaluate((el) => window.getComputedStyle(el).borderColor);
    const tokenColor = await fieldset.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.color = getComputedStyle(el).getPropertyValue(
        "--stratakit-color-border-control-textbox",
      );
      el.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });

    expect(borderColor).toBe(tokenColor);
  });

  test("input border switches to the accent token when focused", async ({ page }) => {
    const fieldset = page.locator(".MuiOutlinedInput-notchedOutline").first();
    const idleBorderColor = await fieldset.evaluate(
      (el) => window.getComputedStyle(el).borderColor,
    );

    // Click to trigger MUI's Mui-focused class (focus() alone does not)
    await page.locator(INPUT_SELECTOR).click();

    const focusedBorderColor = await fieldset.evaluate(
      (el) => window.getComputedStyle(el).borderColor,
    );
    const tokenColor = await fieldset.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.color = getComputedStyle(el).getPropertyValue(
        "--stratakit-color-border-accent-base",
      );
      el.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });

    expect(focusedBorderColor).not.toBe(idleBorderColor);
    expect(focusedBorderColor).toBe(tokenColor);
  });

  // ── Spacing ─────────────────────────────────────────────────────────────────

  test("there is a gap between the input field and the Send button", async ({ page }) => {
    const inputRoot = page.locator(".MuiOutlinedInput-root").first();
    const sendButton = page.getByRole("button", { name: /send/i });

    const inputBox = await inputRoot.boundingBox();
    const buttonBox = await sendButton.boundingBox();

    expect(inputBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();

    const gap = buttonBox!.x - (inputBox!.x + inputBox!.width);
    expect(gap).toBeGreaterThanOrEqual(6);
  });

  // ── Padding inside the native <input> ───────────────────────────────────────

  test("input has horizontal padding between text and border", async ({ page }) => {
    const inputEl = page.locator(INPUT_SELECTOR);

    const paddingLeft = await inputEl.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingLeft),
    );
    const paddingRight = await inputEl.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingRight),
    );

    expect(paddingLeft).toBeGreaterThanOrEqual(10);
    expect(paddingRight).toBeGreaterThanOrEqual(10);
  });

  test("input has vertical padding between text and border", async ({ page }) => {
    const inputEl = page.locator(INPUT_SELECTOR);

    const paddingTop = await inputEl.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingTop),
    );
    const paddingBottom = await inputEl.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom),
    );

    expect(paddingTop).toBeGreaterThanOrEqual(6);
    expect(paddingBottom).toBeGreaterThanOrEqual(6);
  });
});

// ── Send button ──────────────────────────────────────────────────────────────

test.describe("Send button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(INPUT_SELECTOR, { timeout: 30000 });
  });

  test("Send button is visible and labelled", async ({ page }) => {
    const button = page.getByRole("button", { name: /send/i });
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/send/i);
  });

  test("Send button is disabled when input is empty", async ({ page }) => {
    const button = page.getByRole("button", { name: /send/i });
    // Input starts empty so button must be disabled
    await expect(button).toBeDisabled();
  });

  test("Send button becomes enabled when text is typed", async ({ page }) => {
    const inputEl = page.locator(INPUT_SELECTOR);
    const button = page.getByRole("button", { name: /send/i });

    await inputEl.fill("fly to Tokyo");
    await expect(button).toBeEnabled();
  });

  test("Send button has no coloured border", async ({ page }) => {
    const button = page.getByRole("button", { name: /send/i });

    const borderStyle = await button.evaluate((el) => window.getComputedStyle(el).borderStyle);
    expect(borderStyle).toBe("none");
  });

  test("Send button has padding between text and border", async ({ page }) => {
    const button = page.getByRole("button", { name: /send/i });

    const paddingLeft = await button.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingLeft),
    );
    const paddingRight = await button.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingRight),
    );
    const paddingTop = await button.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingTop),
    );
    const paddingBottom = await button.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom),
    );

    expect(paddingLeft).toBeGreaterThanOrEqual(12);
    expect(paddingRight).toBeGreaterThanOrEqual(12);
    expect(paddingTop).toBeGreaterThanOrEqual(6);
    expect(paddingBottom).toBeGreaterThanOrEqual(6);
  });

  test("Send button has correct border-radius", async ({ page }) => {
    const button = page.getByRole("button", { name: /send/i });

    const borderRadius = await button.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).borderRadius),
    );
    expect(borderRadius).toBeGreaterThanOrEqual(4);
  });

  test("Send button submits the form and clears the input", async ({ page }) => {
    const inputEl = page.locator(INPUT_SELECTOR);
    const button = page.getByRole("button", { name: /send/i });

    await inputEl.fill("test message");
    await button.click();

    // After submit the input should clear (client.input = '' after submit)
    await expect(inputEl).toHaveValue("");
  });
});
