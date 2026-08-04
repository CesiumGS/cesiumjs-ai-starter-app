import session, { type SessionOptions } from "express-session";
import type { RequestHandler } from "express";

export interface CreateSessionMiddlewareOptions {
  /** Cookie-signing secret loaded from `SESSION_SECRET`. */
  secret: string;
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
export function createSessionMiddleware(options: CreateSessionMiddlewareOptions): RequestHandler {
  const { secret, secure = false, store } = options;

  if (!secret.trim()) {
    throw new Error("SESSION_SECRET must be set when session-scoped MCP connections are enabled.");
  }
  if (!store) {
    console.warn(
      "[session] No session store configured - using express-session's in-memory MemoryStore. " +
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
