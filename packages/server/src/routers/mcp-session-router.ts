import type { SessionMcpManager } from "@cesium-ai/mcp-tools";
import { Router, type Request, type Response } from "express";
// Type-only: pulls in express-session's ambient augmentation of Express's
// `Request` (adds `sessionID`/`session`) without adding a runtime import —
// every route below keys off `req.sessionID`, but the host app owns
// actually mounting `express-session` middleware.
import type {} from "express-session";

/**
 * The shape pushed to the OAuth popup's opener via `window.postMessage` once
 * `/api/mcp/callback` resolves — mirrors `McpOAuthResultMessage` in
 * `@cesium-ai/chat-element`'s `mcp-oauth-channel.ts` (kept in sync manually;
 * this package has no dependency on that frontend package). `source` lets a
 * listener ignore unrelated same-window `message` events without needing to
 * check `event.origin` (a host app doesn't know, or need to know, which
 * origin(s) host a frontend for it — see below).
 */
interface McpOAuthResultMessage {
  source: "cesium-ai-mcp-oauth-result";
  server: string;
  connected: boolean;
  error?: string;
}

/**
 * `JSON.stringify` plus escaping `<` so a literal `</script>` substring
 * inside a value (e.g. an OAuth-provider-controlled `error_description`)
 * can't terminate the surrounding `<script>` block early and inject markup
 * — browsers scan for that sequence textually, not JS-string-aware, so
 * `JSON.stringify` alone (which only escapes `"`/control chars) isn't
 * enough.
 */
function toInlineScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Renders the plain HTML page shown inside the OAuth popup once this
 * router's shared `/api/mcp/callback` route resolves. Deliberately rendered
 * by the backend itself rather than redirecting to "the" frontend: a host
 * app may serve more than one frontend origin (or none known to it — e.g.
 * an embeddable widget on arbitrary host pages), and there's no single
 * frontend URL that's always correct to bounce back to. Pushes the resolved
 * outcome to `window.opener` via `postMessage` — the frontend side
 * (`@cesium-ai/chat-element`'s `McpConnect.tsx`) validates it came from the
 * specific popup `Window` it opened, rather than by origin, since this page
 * doesn't know the opener's origin either. `title`/`body` are fixed strings
 * (never derived from request input), so only the JSON payload embedded in
 * the script needs escaping.
 */
function renderMcpCallbackHtml(message: McpOAuthResultMessage): string {
  const title = message.connected ? "Connected" : "Connection failed";
  const body = message.connected
    ? "You can close this window and return to the app."
    : "Return to the app to see what went wrong.";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body style="font-family: sans-serif; padding: 2rem; color: #fff; background: #111;">
<h1>${title}</h1>
<p>${body}</p>
<script>
(function () {
  var message = ${toInlineScriptJson(message)};
  if (window.opener) {
    try { window.opener.postMessage(message, "*"); } catch (e) {}
  }
  setTimeout(function () { window.close(); }, 1500);
})();
</script>
</body>
</html>`;
}

/**
 * Builds `/api/mcp/*` routes for user-initiated, per-browser-session MCP
 * OAuth connections (e.g. a "Connect to Cesium ion" UI button) — the
 * dynamic counterpart to operator-configured, always-on servers. Requires
 * the host app to mount `express-session` (or equivalent) middleware
 * earlier in the pipeline, since every route keys off `req.sessionID`.
 *
 * Routes mounted:
 * - `GET  /api/mcp/session/servers`     — list session-connectable server names
 * - `POST /api/mcp/:server/connect`     — begin OAuth flow; returns `{ authorizationUrl }`
 * - `GET  /api/mcp/callback`            — shared OAuth callback; renders popup HTML
 * - `GET  /api/mcp/:server/status`      — connection status + last error if disconnected
 * - `POST /api/mcp/:server/disconnect`  — close and discard the session connection
 */
export function createMcpSessionRouter(sessionMcp: SessionMcpManager): Router {
  const router = Router();

  function requireKnownServer(req: Request, res: Response): string | undefined {
    const { server } = req.params;
    if (typeof server !== "string" || !sessionMcp.serverNames.includes(server)) {
      res
        .status(404)
        .json({ error: `Unknown session-connectable MCP server "${String(server)}".` });
      return undefined;
    }
    return server;
  }

  router.get("/api/mcp/session/servers", (_req, res) => {
    res.json({ servers: sessionMcp.serverNames });
  });

  router.post("/api/mcp/:server/connect", async (req, res) => {
    const server = requireKnownServer(req, res);
    if (!server) return;

    const result = await sessionMcp.connect(req.sessionID, server);
    if ("error" in result) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ authorizationUrl: result.authorizationUrl });
  });

  router.get("/api/mcp/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : undefined;

    const authError = req.query.error;
    if (typeof authError === "string") {
      const description =
        typeof req.query.error_description === "string" ? req.query.error_description : authError;
      const message = `Authorization was denied: ${description}`;
      const server = await sessionMcp.cancelPending(req.sessionID, state, message);
      res
        .status(200)
        .type("html")
        .send(
          renderMcpCallbackHtml({
            source: "cesium-ai-mcp-oauth-result",
            server: server ?? "",
            connected: false,
            error: message,
          }),
        );
      return;
    }

    const code = req.query.code;
    if (typeof code !== "string") {
      const message = "Missing authorization code.";
      const server = await sessionMcp.cancelPending(req.sessionID, state, message);
      res
        .status(200)
        .type("html")
        .send(
          renderMcpCallbackHtml({
            source: "cesium-ai-mcp-oauth-result",
            server: server ?? "",
            connected: false,
            error: message,
          }),
        );
      return;
    }

    const result = await sessionMcp.completeCallback(req.sessionID, code, state);
    res
      .status(200)
      .type("html")
      .send(
        renderMcpCallbackHtml({
          source: "cesium-ai-mcp-oauth-result",
          server: result.serverName ?? "",
          connected: "connected" in result && result.connected === true,
          error: "error" in result ? result.error : undefined,
        }),
      );
  });

  router.get("/api/mcp/:server/status", async (req, res) => {
    const server = requireKnownServer(req, res);
    if (!server) return;
    const connected = await sessionMcp.isConnected(req.sessionID, server);
    // Only surface a failure reason while NOT connected — once connected,
    // any older recorded failure (e.g. from an earlier failed attempt) is
    // irrelevant and would be confusing to show.
    const error = connected ? undefined : await sessionMcp.consumeLastError(req.sessionID, server);
    res.json({ connected, ...(error ? { error } : {}) });
  });

  router.post("/api/mcp/:server/disconnect", async (req, res) => {
    const server = requireKnownServer(req, res);
    if (!server) return;
    await sessionMcp.disconnect(req.sessionID, server);
    res.json({ connected: false });
  });

  return router;
}
