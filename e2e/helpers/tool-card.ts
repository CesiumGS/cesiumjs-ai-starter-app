import type { Locator, Page } from "@playwright/test";

/**
 * Locates the last tool card `<details>` element whose summary matches `[tool] <toolName>` and
 * force-expands it, then keeps it forced open for the rest of the page's lifetime.
 *
 * `MessageItem.tsx`'s `ToolCard` computes `open={defaultOpen}` fresh on every render
 * (`isPendingApproval || combinedLength <= AUTO_EXPAND_THRESHOLD`) — React re-applies the DOM
 * `open` attribute whenever that computed value changes between renders, and it commonly DOES
 * change: the transition from "pending approval" (`defaultOpen` true) to "result just arrived"
 * (`defaultOpen` false once real generated CesiumJS code pushes combined text past the 300-char
 * threshold) happens on the very next render after this helper's one-time `.open = true` — races
 * with whatever async wait a caller does next and can silently re-collapse the `<pre>` blocks
 * mid-wait. A single direct DOM mutation isn't enough to survive that; attaching a `MutationObserver`
 * that re-forces `open = true` on every subsequent attribute change makes this durable regardless
 * of how many more times the component re-renders.
 */
export async function expandToolCard(page: Page, toolName: string): Promise<Locator> {
  const card = page
    .locator("details")
    .filter({ hasText: new RegExp(`\\[tool\\]\\s*${toolName}`) })
    .last();
  await card.evaluate((el) => {
    const details = el as HTMLDetailsElement & { __forceOpenObserver__?: MutationObserver };
    details.open = true;
    if (!details.__forceOpenObserver__) {
      const observer = new MutationObserver(() => {
        if (!details.open) {
          details.open = true;
        }
      });
      observer.observe(details, { attributes: true, attributeFilter: ["open"] });
      details.__forceOpenObserver__ = observer;
    }
  });
  return card;
}

export interface ExecuteCesiumCodeResultInfo {
  /** Present if generation/AST-verification failed (result was `{ error }`, no `code`). */
  error?: string;
  /** Present if the code passed verification but threw at runtime (`{ code, executionError }`). */
  executionError?: string;
  /** True once the `.codeBlock` `<pre>` (raw generated source) is rendered. */
  hasCode: boolean;
}

/**
 * Reads a resolved `executeCesiumCode` tool result off an already-expanded tool card (see
 * {@link expandToolCard}).
 *
 * Unlike a generic tool result, `executeCesiumCode`'s result is rendered by the dedicated
 * `ExecuteCesiumCodeResult` component (`MessageItem.tsx`): a string `code` field gets its own
 * `.codeBlock` `<pre>` (raw source text). Both failure fields render in their own
 * critical/error-styled `ToolResultErrorPanel`, each a SIBLING of the tool card's `<details>`
 * (intentionally NOT nested inside it): a generation/verification `error` field in
 * `[data-testid="generation-error-panel"]`, and a runtime `executionError` field in
 * `[data-testid="execution-error-panel"]`. So this can't `JSON.parse()` the result and instead
 * reads each field off its own panel selector.
 */
export async function readExecuteCesiumCodeResult(
  toolCard: Locator,
): Promise<ExecuteCesiumCodeResultInfo> {
  const codeBlock = toolCard.locator('pre[class*="codeBlock"]');
  const generationErrorPanel = toolCard.locator(
    'xpath=following-sibling::*[@data-testid="generation-error-panel"][1]',
  );
  const executionErrorPanel = toolCard.locator(
    'xpath=following-sibling::*[@data-testid="execution-error-panel"][1]',
  );
  const hasCode = (await codeBlock.count()) > 0;
  const errorText =
    (await generationErrorPanel.count()) > 0
      ? await generationErrorPanel.locator("pre").innerText()
      : undefined;
  const executionErrorText =
    (await executionErrorPanel.count()) > 0
      ? await executionErrorPanel.locator("pre").innerText()
      : undefined;
  return {
    error: errorText,
    executionError: executionErrorText,
    hasCode,
  };
}
