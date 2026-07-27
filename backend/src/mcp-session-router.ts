import type { SessionMcpManager } from "@cesium-ai/mcp-tools";
import { Router, type Request, type Response } from "express";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the page shown in the OAuth popup once the redirect lands back on
 * this backend. Posts a result message to `window.opener` and self-closes.
 *
 * `targetOrigin: "*"` is deliberate: the message carries no secrets (just
 * `{server, ok}` — tokens never leave the backend), and this backend doesn't
 * reliably know which single origin opened the popup (`ALLOWED_ORIGIN` can
 * be a list).
 */
function callbackResultPage(server: string, ok: boolean, message: string): string {
  const title = ok ? "Connected" : "Connection failed";
  // JSON strings can contain a literal `</script>`, which HTML parsers treat
  // as the end of this script even though JavaScript sees it inside a string.
  // Escape `<` before embedding any provider-controlled error text.
  const payload = JSON.stringify({ type: "cesium-ai-mcp-oauth", server, ok, message }).replace(
    /</g,
    "\\u003c",
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>
<script>
  if (window.opener) { window.opener.postMessage(${payload}, "*"); }
  window.close();
</script>
</body></html>`;
}

/**
 * Builds `/api/mcp/*` routes for user-initiated, per-browser-session MCP
 * OAuth connections (e.g. a "Connect to Cesium ion" UI button) \u2014 the
 * dynamic counterpart to operator-configured, always-on servers. Requires
 * session middleware (see `../utils/session.js`) mounted
 * earlier in the pipeline, since every route keys off `req.sessionID`.
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
      const serverName = await sessionMcp.cancelPending(req.sessionID, state);
      res.send(
        callbackResultPage(
          serverName ?? "unknown",
          false,
          `Authorization was denied: ${description}`,
        ),
      );
      return;
    }

    const code = req.query.code;
    if (typeof code !== "string") {
      const serverName = await sessionMcp.cancelPending(req.sessionID, state);
      res.status(400).send(callbackResultPage(serverName ?? "unknown", false, "Missing authorization code."));
      return;
    }

    const result = await sessionMcp.completeCallback(req.sessionID, code, state);
    if ("error" in result) {
      res.status(502).send(callbackResultPage(result.serverName ?? "unknown", false, result.error));
      return;
    }
    res.send(
      callbackResultPage(
        result.serverName,
        true,
        "You can close this window and return to the app.",
      ),
    );
  });

  router.get("/api/mcp/:server/status", async (req, res) => {
    const server = requireKnownServer(req, res);
    if (!server) return;
    res.json({ connected: await sessionMcp.isConnected(req.sessionID, server) });
  });

  router.post("/api/mcp/:server/disconnect", async (req, res) => {
    const server = requireKnownServer(req, res);
    if (!server) return;
    await sessionMcp.disconnect(req.sessionID, server);
    res.json({ connected: false });
  });

  return router;
}
