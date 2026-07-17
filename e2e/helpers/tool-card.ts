import type { Locator, Page } from "@playwright/test";

/**
 * Locates the last tool card `<details>` element whose summary matches `[tool] <toolName>` and
 * force-expands it by directly setting the DOM `open` property.
 *
 * `MessageItem.tsx`'s `ToolCard` auto-collapses (`open={defaultOpen}`) once a tool call resolves
 * if its combined args/result text exceeds `AUTO_EXPAND_THRESHOLD` (300 chars) — real generated
 * CesiumJS code routinely does, which hides the `<pre>` blocks e2e specs assert on from
 * Playwright's visibility checks (collapsed `<details>` content isn't rendered).
 *
 * Mutating `.open` directly (rather than clicking the `<summary>`) is safe against any later
 * re-render: React only re-applies the `open` DOM attribute when the computed `defaultOpen` prop
 * value itself changes between renders, which it doesn't once a tool call has settled, so this
 * direct DOM override sticks.
 */
export async function expandToolCard(page: Page, toolName: string): Promise<Locator> {
  const card = page
    .locator("details")
    .filter({ hasText: new RegExp(`\\[tool\\]\\s*${toolName}`) })
    .last();
  await card.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
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
 * `ExecuteCesiumCodeResult` component (`MessageItem.tsx`), NOT as one JSON blob: a string `code`
 * field gets its own `.codeBlock` `<pre>` (raw source text), and any other fields
 * (`error`/`executionError` — mutually exclusive in practice) render as human-readable
 * `key:\n<value>` text via `formatToolPayload` in a separate `.toolResult` `<pre>`. So this can't
 * `JSON.parse()` the result and instead detects each field by its own selector/prefix.
 */
export async function readExecuteCesiumCodeResult(
  toolCard: Locator,
): Promise<ExecuteCesiumCodeResultInfo> {
  const codeBlock = toolCard.locator('pre[class*="codeBlock"]');
  const resultInfoBlock = toolCard.locator('pre[class*="toolResult"]');
  const hasCode = (await codeBlock.count()) > 0;
  const resultText = (await resultInfoBlock.count()) > 0 ? await resultInfoBlock.innerText() : "";
  return {
    error: extractStringField(resultText, "error"),
    executionError: extractStringField(resultText, "executionError"),
    hasCode,
  };
}

/**
 * `formatToolPayload` renders a top-level string field as `${key}:\n${value}`. Since
 * `executeCesiumCode`'s `rest` (everything but `code`) only ever holds at most one of
 * `error`/`executionError`, the whole `.toolResult` text is exactly that single `key:\nvalue`
 * pair when present — no need to handle multiple joined fields.
 */
function extractStringField(text: string, key: string): string | undefined {
  const prefix = `${key}:\n`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : undefined;
}
