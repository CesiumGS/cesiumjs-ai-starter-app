import type { ToolSet } from "ai";
import { noopMcpToolsLogger, type McpToolsLogger } from "../logger.js";
import type { ConnectedMcpConnection, PendingMcpConnection } from "../storage/models.js";
import type {
  McpConnectedConnectionRepository,
  McpPendingConnectionRepository,
} from "../storage/repositories.js";
import {
  beginSessionOAuthConnect,
  completeSessionOAuthConnect,
} from "./session-oauth-connect.js";
import { withTimeout } from "../tool-timeout.js";
import type { McpServerConfig } from "../types.js";

export interface SessionMcpManagerOptions {
  /**
   * MCP servers a browser session may interactively connect to via
   * `connect()`/`completeCallback()` — distinct from `createMcpTools`'s
   * operator-configured, always-on servers. Every entry here is treated as
   * OAuth-gated; `transport.oauth` (if set) is just optional overrides
   * (clientId/clientSecret/clientName), not a required marker. Should be
   * `createMcpTools`'s `authRequiredServers` — this manager doesn't detect
   * anything itself.
   */
  servers: readonly McpServerConfig[];
  /**
   * Builds the ONE OAuth redirect/callback URL shared by every session
   * server (e.g. `${PUBLIC_URL}/api/mcp/callback`) — must be a publicly
   * reachable route on this backend, not a loopback address. Server-name-
   * agnostic by design: the callback routes to the right pending flow via
   * the OAuth `state` parameter, so only one redirect URI needs registering
   * per third-party OAuth app.
   */
  buildRedirectUrl: () => string;
  /** Per-tool-call timeout (ms) for session-connected tools. Defaults to 30s. */
  timeoutMs?: number;
  /**
   * How long (ms) a `connect()` attempt stays "in flight" before a later
   * `connect()` for the same session+server may supersede it instead of
   * failing with "already pending" — lets a user recover from an abandoned
   * attempt (e.g. closed popup) without a server restart. Defaults to 2
   * minutes.
   */
  pendingTtlMs?: number;
  /**
   * Storage for in-flight OAuth connection attempts. Defaults to a private
   * in-memory implementation. Pass your own (e.g. Redis-backed) to share
   * this state across multiple backend instances.
   */
  pendingRepository?: McpPendingConnectionRepository;
  /**
   * Storage for live, connected MCP sessions. Defaults to a private
   * in-memory implementation. Unlike `pendingRepository`, this can never be
   * backed by anything but process memory (holds live client connections) —
   * this option exists mainly so a host can observe connection lifecycle.
   */
  connectedRepository?: McpConnectedConnectionRepository;
  logger?: McpToolsLogger;
}

export interface SessionMcpManager {
  /**
   * Begins the OAuth flow for `serverName` on behalf of `sessionId`,
   * returning the URL to send the browser to. Always uses the
   * operator-configured OAuth client (`serverName`'s config) — there is no
   * caller-supplied override.
   */
  connect: (
    sessionId: string,
    serverName: string,
  ) => Promise<{ authorizationUrl: string } | { error: string }>;
  /**
   * Completes a pending flow using the `code`/`state` the shared callback
   * route received — `serverName` is resolved internally from `state` and
   * returned so the caller can report which server succeeded/failed.
   */
  completeCallback: (
    sessionId: string,
    code: string,
    state: string | undefined,
  ) => Promise<{ connected: true; serverName: string } | { error: string; serverName?: string }>;
  /** Cancels a pending flow matching `state` for `sessionId` without exchanging a code (e.g. consent denied) — returns the server name it belonged to, if any. */
  cancelPending: (sessionId: string, state: string | undefined) => Promise<string | undefined>;
  /** Namespaced, timeout-wrapped tools from every server `sessionId` has connected, merged into one `ToolSet`. */
  getSessionTools: (sessionId: string) => Promise<ToolSet>;
  /** Whether `sessionId` currently has a live connection to `serverName`. */
  isConnected: (sessionId: string, serverName: string) => Promise<boolean>;
  /** The session-connectable servers this manager was configured with, for UI/introspection. */
  serverNames: readonly string[];
  /** Closes `sessionId`'s connection to one `serverName` (if any) and discards its state. */
  disconnect: (sessionId: string, serverName: string) => Promise<void>;
  /** Closes every MCP client connection belonging to `sessionId` and discards its state (e.g. on session destroy/logout). */
  disconnectSession: (sessionId: string) => Promise<void>;
  /** Closes EVERY connection across ALL sessions. Call once on process shutdown. */
  closeAll: () => Promise<void>;
}

const DEFAULT_PENDING_TTL_MS = 2 * 60 * 1000;

/**
 * Private, unexported in-memory default for {@link McpPendingConnectionRepository},
 * used when the host doesn't supply its own. This package ships no
 * concrete implementation as part of its public API — a host wanting a
 * distributed store implements the interface itself and passes it in.
 */
function createDefaultPendingRepository(): McpPendingConnectionRepository {
  const byId = new Map<string, PendingMcpConnection>();
  const byState = new Map<string, PendingMcpConnection>();

  return {
    findById: (id) => byId.get(id),
    findByState: (state) => byState.get(state),
    save(id, entry) {
      byId.set(id, entry);
      byState.set(entry.state, entry);
    },
    delete(id) {
      const entry = byId.get(id);
      if (!entry) return;
      byId.delete(id);
      byState.delete(entry.state);
    },
  };
}

/** Private, unexported in-memory default for {@link McpConnectedConnectionRepository} — see {@link createDefaultPendingRepository}. */
function createDefaultConnectedRepository(): McpConnectedConnectionRepository {
  const byId = new Map<string, ConnectedMcpConnection>();

  return {
    findById: (id) => byId.get(id),
    save(id, entry) {
      byId.set(id, entry);
    },
    delete(id) {
      byId.delete(id);
    },
    listAll: () => [...byId.values()],
  };
}

/**
 * Manages per-browser-session, user-initiated OAuth connections to MCP
 * servers — unlike `createMcpTools` (one shared set of servers connected
 * once at startup), every credential/connection here is in-memory by
 * default, scoped to one `sessionId`, and fully discarded (client closed,
 * tokens/PKCE state dropped) on `disconnectSession`.
 */
export function createSessionMcpManager(options: SessionMcpManagerOptions): SessionMcpManager {
  const {
    servers,
    buildRedirectUrl,
    timeoutMs = 30_000,
    pendingTtlMs = DEFAULT_PENDING_TTL_MS,
    pendingRepository = createDefaultPendingRepository(),
    connectedRepository = createDefaultConnectedRepository(),
    logger = noopMcpToolsLogger,
  } = options;
  const serverByName = new Map(servers.map((server) => [server.name, server]));

  /** Turns a `(sessionId, serverName)` pair into the opaque `id` string the repositories are keyed by — they don't need to know what it means. */
  function connectionId(sessionId: string, serverName: string): string {
    return `${sessionId}:${serverName}`;
  }

  async function connect(sessionId: string, serverName: string) {
    const server = serverByName.get(serverName);
    if (!server) return { error: `Unknown session-connectable MCP server "${serverName}".` };

    const id = connectionId(sessionId, serverName);
    const existingPending = await pendingRepository.findById(id);
    if (existingPending) {
      const age = Date.now() - existingPending.startedAt;
      if (age < pendingTtlMs) {
        return {
          error: `An OAuth connection for "${serverName}" is already pending on this session.`,
        };
      }
      // The previous attempt is old enough to have been abandoned (e.g. the
      // user closed the OAuth popup without finishing, or the provider never
      // redirected back) — forget it and let this new attempt proceed instead
      // of leaving the user stuck forever with no way to retry.
      logger.warn(`Superseding a stale pending OAuth connection for "${serverName}"`, {
        ageMs: age,
      });
      await pendingRepository.delete(id);
    }

    const result = await beginSessionOAuthConnect({
      server,
      redirectUrl: buildRedirectUrl(),
      logger,
    });
    if ("error" in result) return result;

    // The shared callback route has no server name in its URL, so `state`
    // (already generated + persisted by the provider during the flow just
    // started above) is the only thing available to route the eventual
    // callback back to this exact session+server. `storedState` is
    // optional on `OAuthClientProvider` in general, but always implemented
    // by our own `createOAuthClientProvider`.
    const state = await result.pending.provider.storedState?.();
    if (!state) {
      return {
        error: `MCP server "${serverName}" did not produce an OAuth "state" value, which this app requires to route its shared callback route.`,
      };
    }

    await pendingRepository.save(id, {
      sessionId,
      serverName,
      state,
      oauth: result.pending,
      startedAt: Date.now(),
    });
    return { authorizationUrl: result.authorizationUrl };
  }

  async function completeCallback(sessionId: string, code: string, state: string | undefined) {
    const entry = typeof state === "string" ? await pendingRepository.findByState(state) : undefined;
    if (!entry || entry.sessionId !== sessionId) {
      return { error: "No pending OAuth connection matches the given state for this session." };
    }
    await pendingRepository.delete(connectionId(entry.sessionId, entry.serverName));

    const result = await completeSessionOAuthConnect(entry.oauth, code, state, logger);
    if ("error" in result) return { error: result.error, serverName: entry.serverName };

    const tools: ToolSet = {};
    for (const [namespaced, toolDef] of result.toolEntries) {
      tools[namespaced] = withTimeout(toolDef, timeoutMs, namespaced, logger);
    }
    await replaceConnection({
      sessionId: entry.sessionId,
      serverName: entry.serverName,
      client: result.client,
      tools,
    });
    return { connected: true as const, serverName: entry.serverName };
  }

  async function cancelPending(
    sessionId: string,
    state: string | undefined,
  ): Promise<string | undefined> {
    const entry = typeof state === "string" ? await pendingRepository.findByState(state) : undefined;
    if (!entry || entry.sessionId !== sessionId) return undefined;
    await pendingRepository.delete(connectionId(entry.sessionId, entry.serverName));
    return entry.serverName;
  }

  async function getSessionTools(sessionId: string): Promise<ToolSet> {
    const tools: ToolSet = {};
    for (const server of servers) {
      const entry = await connectedRepository.findById(connectionId(sessionId, server.name));
      if (entry) Object.assign(tools, entry.tools);
    }
    return tools;
  }

  async function isConnected(sessionId: string, serverName: string): Promise<boolean> {
    return (await connectedRepository.findById(connectionId(sessionId, serverName))) !== undefined;
  }

  async function closeConnection(sessionId: string, serverName: string): Promise<void> {
    const id = connectionId(sessionId, serverName);
    const entry = await connectedRepository.findById(id);
    if (!entry) return;
    await connectedRepository.delete(id);
    try {
      await entry.client.close();
    } catch (err) {
      logger.error(`Error closing session MCP client`, {
        server: serverName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function replaceConnection(entry: ConnectedMcpConnection): Promise<void> {
    await closeConnection(entry.sessionId, entry.serverName);
    await connectedRepository.save(connectionId(entry.sessionId, entry.serverName), entry);
  }

  async function closeEntry(sessionId: string, serverName: string): Promise<void> {
    const id = connectionId(sessionId, serverName);
    const pendingEntry = await pendingRepository.findById(id);
    if (pendingEntry) await pendingRepository.delete(id);
    await closeConnection(sessionId, serverName);
  }

  async function disconnect(sessionId: string, serverName: string): Promise<void> {
    await closeEntry(sessionId, serverName);
  }

  async function disconnectSession(sessionId: string): Promise<void> {
    for (const server of servers) {
      await closeEntry(sessionId, server.name);
    }
  }

  async function closeAll(): Promise<void> {
    const allConnected = await connectedRepository.listAll();
    const results = await Promise.allSettled(
      allConnected.map(async (entry) => {
        await connectedRepository.delete(connectionId(entry.sessionId, entry.serverName));
        return entry.client.close();
      }),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        logger.error(`Error while closing a session MCP client connection`, {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  return {
    connect,
    completeCallback,
    cancelPending,
    getSessionTools,
    isConnected,
    serverNames: servers.map((server) => server.name),
    disconnect,
    disconnectSession,
    closeAll,
  };
}

