import session, { type SessionOptions } from "express-session";
import type { RequestHandler } from "express";

/**
 * Fixed, publicly-known fallback so local dev works with zero config. Never
 * use this in a real deployment — anyone who reads this source can forge a
 * session cookie signed with it, riding a stolen/guessed session ID onto
 * another user's connected MCP tools.
 */
const DEV_ONLY_DEFAULT_SESSION_SECRET = "cesium-ai-starter-app-dev-only-session-secret-change-me";

export interface CreateSessionMiddlewareOptions {
  /** Cookie-signing secret. Falls back to a dev-only constant (with a startup warning) when unset. */
  secret?: string;
  /** Marks the session cookie `Secure` (HTTPS-only). Set `true` in production. */
  secure?: boolean;
  /**
   * `express-session` session store. Defaults to the package's own in-memory
   * `MemoryStore` (fine for local dev / a single instance) — loses every
   * session (and any MCP connections keyed by its ID) on restart and can't
   * be shared across instances. Pass a real store (e.g. `connect-redis`) in
   * production.
   *
   * Note this only replaces the session-ID/cookie layer. `SessionMcpManager`
   * keeps its OWN in-memory state (live MCP clients, in-flight OAuth
   * attempts) keyed by that session ID — multiple backend instances each
   * need their own `SessionMcpManager`, and a browser session must
   * consistently reach the SAME instance (sticky sessions) for its MCP
   * connections to keep working. Swapping this option alone does not make
   * session-scoped MCP connections multi-instance-safe.
   */
  store?: SessionOptions["store"];
}

/**
 * Builds the `express-session` middleware backing per-browser-session MCP
 * OAuth connections. Uses the in-memory `MemoryStore` unless a `store` is
 * supplied — sessions (and any MCP connections keyed by their ID) are lost
 * on process restart. `saveUninitialized` is `true` so every visitor gets a
 * stable session ID/cookie from their first request, before they ever touch
 * an MCP-connect endpoint — required so the OAuth callback redirect (a
 * separate top-level navigation) carries the same ID.
 */
export function createSessionMiddleware(
  options: CreateSessionMiddlewareOptions = {},
): RequestHandler {
  const { secret = DEV_ONLY_DEFAULT_SESSION_SECRET, secure = false, store } = options;

  if (secret === DEV_ONLY_DEFAULT_SESSION_SECRET) {
    console.warn(
      "[session] SESSION_SECRET is not set \u2014 using a fixed, publicly-known development secret. " +
        "Set a real SESSION_SECRET before deploying with an auth-required MCP server detected.",
    );
  }
  if (!store) {
    console.warn(
      "[session] No session store configured \u2014 using express-session's in-memory MemoryStore. " +
        "Sessions (and any MCP connections tied to them) are lost on restart and are not shared " +
        "across multiple backend instances. Pass a real store (e.g. connect-redis) in production.",
    );
  }

  const config: SessionOptions = {
    secret,
    resave: false,
    saveUninitialized: true,
    store,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  return session(config);
}
