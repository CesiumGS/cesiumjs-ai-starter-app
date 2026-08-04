/** The outcome of one session MCP OAuth connect attempt, for a specific server. */
export interface McpOAuthResultMessage {
  source: "cesium-ai-mcp-oauth-result";
  server: string;
  connected: boolean;
  error?: string;
}

/**
 * Type guard narrowing an arbitrary `message` event payload to
 * {@link McpOAuthResultMessage} — guards against any other same-window
 * `message` event a host page might dispatch/receive for unrelated reasons.
 */
function isMcpOAuthResultMessage(data: unknown): data is McpOAuthResultMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === "cesium-ai-mcp-oauth-result" &&
    typeof (data as { server?: unknown }).server === "string" &&
    typeof (data as { connected?: unknown }).connected === "boolean"
  );
}

/**
 * Subscribes to the session MCP OAuth outcome pushed via `window.postMessage`
 * by the OAuth popup itself (backend-rendered — see `@cesium-ai/server`'s
 * `mcp-session-router.ts`'s `renderMcpCallbackHtml`) once
 * it resolves. Filters on `event.source === popup` — the specific `Window`
 * reference the caller opened (see `McpConnect.tsx`'s `handleConnect`) —
 * rather than `event.origin`, since this backend may be shared by more than
 * one frontend origin (or embedded on an origin unknown to it ahead of
 * time), so there's no fixed origin string to check against. Matching the
 * exact window object is at least as strong a guarantee: only that specific
 * popup (or something it explicitly forwards to) can produce a message with
 * `event.source` equal to it. Returns an unsubscribe function.
 */
export function listenForMcpOAuthResult(
  popup: Window,
  onMessage: (message: McpOAuthResultMessage) => void,
): () => void {
  const handler = (event: MessageEvent<unknown>) => {
    if (event.source !== popup) return;
    if (!isMcpOAuthResultMessage(event.data)) return;
    onMessage(event.data);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
