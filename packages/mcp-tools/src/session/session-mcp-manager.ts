import type { MCPClient } from "@ai-sdk/mcp";
import type { McpTool } from "../mcp-app-meta.js";
import { noopMcpToolsLogger, type McpToolsLogger } from "../logger.js";
import {
  toConnectedMcpConnectionDescriptor,
  toPendingMcpConnectionDescriptor,
  type ConnectedMcpConnection,
  type ConnectedMcpConnectionDescriptor,
  type PendingMcpConnection,
  type PendingMcpConnectionDescriptor,
} from "../storage/models.js";
import {
  createInMemoryConnectedRepository,
  createInMemoryPendingRepository,
} from "../storage/in-memory-repositories.js";
import type {
  McpConnectionRepository,
  McpPendingConnectionRepository,
} from "../storage/repositories.js";
import { beginSessionOAuthConnect, completeSessionOAuthConnect } from "./session-oauth-connect.js";
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
   * in-memory implementation. The stored OAuth provider is process-local;
   * alternate implementations are useful for lifecycle observation/testing,
   * not cross-process persistence.
   */
  pendingRepository?: McpPendingConnectionRepository;
  /**
   * Storage for live, connected MCP sessions. Defaults to a private
   * in-memory implementation. Unlike `pendingRepository`, this can never be
   * backed by anything but process memory (holds live client connections) —
   * this option exists mainly so a host can observe connection lifecycle.
   */
  connectedRepository?: McpConnectionRepository<ConnectedMcpConnection>;
  /**
   * Optional cross-process status store for connected sessions, keyed the
   * same way as `connectedRepository`. Unlike `connectedRepository`, this
   * only ever receives/returns {@link ConnectedMcpConnectionDescriptor} —
   * plain data with no live `client`/`tools` — so it's safe to back with
   * Redis, Azure Table, or any other external store. This manager converts
   * to/from the live `ConnectedMcpConnection` internally; callers plugging
   * in a store never see or need the ai-sdk `MCPClient`/`ToolSet` types.
   * Written alongside (never instead of) `connectedRepository`. Omit to skip
   * cross-process status entirely.
   */
  connectedDescriptorRepository?: McpConnectionRepository<ConnectedMcpConnectionDescriptor>;
  /**
   * Optional cross-process status store for in-flight OAuth attempts,
   * mirroring `connectedDescriptorRepository` but for `pendingRepository` —
   * only ever sees {@link PendingMcpConnectionDescriptor} (no live OAuth
   * provider). Written alongside (never instead of) `pendingRepository`.
   * Omit to skip cross-process status entirely.
   */
  pendingDescriptorRepository?: McpConnectionRepository<PendingMcpConnectionDescriptor>;
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
  /**
   * Cancels a pending flow matching `state` for `sessionId` without
   * exchanging a code (e.g. consent denied) — returns the server name it
   * belonged to, if any. `message`, if given, is recorded as the reason a
   * later `consumeLastError` call for that server will report.
   */
  cancelPending: (
    sessionId: string,
    state: string | undefined,
    message?: string,
  ) => Promise<string | undefined>;
  /**
   * Reads and clears the most recent failure reason recorded for
   * `sessionId`'s connection attempt to `serverName` (set by a failed
   * `completeCallback`/`cancelPending`), or `undefined` if none is
   * recorded. Consuming (rather than just reading) it means a stale failure
   * from a past attempt never lingers into a later status check once it's
   * been surfaced once — a fresh `connect()` call also clears it
   * unconditionally. This is how the frontend's `GET .../:server/status`
   * endpoint (fetched by both the OAuth callback page and, as a fallback,
   * the opener window — see `@cesium-ai/chat-element`'s `McpConnect.tsx`)
   * learns *why* a connection attempt failed, without the callback page
   * itself needing to carry that text back via `window.postMessage`.
   */
  consumeLastError: (sessionId: string, serverName: string) => Promise<string | undefined>;
  /**
   * Namespaced, timeout-wrapped tools from every server `sessionId` has
   * connected, merged into one record. A tool that declared a `ui://` MCP
   * Apps widget resource carries that metadata as its own `mcpApp` property
   * (see `McpTool`) rather than in a separate map.
   */
  getSessionTools: (sessionId: string) => Promise<Record<string, McpTool>>;
  /** The live `MCPClient` for `sessionId`'s connection to `serverName`, or `undefined` if not connected — mirrors `McpToolsHandle.getClient`. */
  getSessionClient: (sessionId: string, serverName: string) => Promise<MCPClient | undefined>;
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
    pendingRepository = createInMemoryPendingRepository(),
    connectedRepository = createInMemoryConnectedRepository(),
    connectedDescriptorRepository,
    pendingDescriptorRepository,
    logger = noopMcpToolsLogger,
  } = options;
  const serverByName = new Map(servers.map((server) => [server.name, server]));
  /**
   * Best-effort, process-local record of the last failure reason per
   * `(sessionId, serverName)` — read (and cleared) via `consumeLastError`.
   * Deliberately NOT part of `pendingRepository`/`connectedRepository` (both
   * pluggable for cross-process storage): this is purely a short-lived UI
   * hint, not connection state, so a single-instance in-memory map is an
   * acceptable simplification even for a multi-instance deployment (worst
   * case, the "why did it fail" text just doesn't surface on a replica that
   * didn't handle the callback — `connected`/`pending` state itself is
   * unaffected).
   */
  const lastError = new Map<string, string>();

  /** Turns a `(sessionId, serverName)` pair into the opaque `id` string the repositories are keyed by — they don't need to know what it means. */
  function connectionId(sessionId: string, serverName: string): string {
    return `${sessionId}:${serverName}`;
  }

  /** Saves a pending entry to `pendingRepository` and, if configured, a derived descriptor to `pendingDescriptorRepository`. */
  async function savePending(id: string, entry: PendingMcpConnection): Promise<void> {
    await pendingRepository.save(id, entry);
    await pendingDescriptorRepository?.save(id, toPendingMcpConnectionDescriptor(entry));
  }

  /** Deletes a pending entry from `pendingRepository` and, if configured, its descriptor from `pendingDescriptorRepository`. */
  async function deletePending(id: string): Promise<void> {
    await pendingRepository.delete(id);
    await pendingDescriptorRepository?.delete(id);
  }

  /** Saves a connected entry to `connectedRepository` and, if configured, a derived descriptor to `connectedDescriptorRepository`. */
  async function saveConnected(id: string, entry: ConnectedMcpConnection): Promise<void> {
    await connectedRepository.save(id, entry);
    await connectedDescriptorRepository?.save(id, toConnectedMcpConnectionDescriptor(entry));
  }

  /** Deletes a connected entry from `connectedRepository` and, if configured, its descriptor from `connectedDescriptorRepository`. */
  async function deleteConnected(id: string): Promise<void> {
    await connectedRepository.delete(id);
    await connectedDescriptorRepository?.delete(id);
  }

  async function connect(sessionId: string, serverName: string) {
    const server = serverByName.get(serverName);
    if (!server) return { error: `Unknown session-connectable MCP server "${serverName}".` };

    const id = connectionId(sessionId, serverName);
    // A fresh attempt should never surface a failure reason left over from a
    // PREVIOUS attempt via `consumeLastError` — clear it unconditionally,
    // whether or not this attempt itself succeeds.
    lastError.delete(id);
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
      await deletePending(id);
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

    await savePending(id, {
      sessionId,
      serverName,
      state,
      oauth: result.pending,
      startedAt: Date.now(),
    });
    return { authorizationUrl: result.authorizationUrl };
  }

  async function completeCallback(sessionId: string, code: string, state: string | undefined) {
    const entry =
      typeof state === "string" ? await pendingRepository.findByState(state) : undefined;
    if (!entry || entry.sessionId !== sessionId) {
      return { error: "No pending OAuth connection matches the given state for this session." };
    }
    await deletePending(connectionId(entry.sessionId, entry.serverName));

    const result = await completeSessionOAuthConnect(entry.oauth, code, state, logger);
    if ("error" in result) {
      lastError.set(connectionId(entry.sessionId, entry.serverName), result.error);
      return { error: result.error, serverName: entry.serverName };
    }

    const tools: Record<string, McpTool> = {};
    for (const toolEntry of result.toolEntries) {
      tools[toolEntry.namespacedName] = withTimeout(
        toolEntry.tool,
        timeoutMs,
        toolEntry.namespacedName,
        logger,
      );
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
    message?: string,
  ): Promise<string | undefined> {
    const entry =
      typeof state === "string" ? await pendingRepository.findByState(state) : undefined;
    if (!entry || entry.sessionId !== sessionId) return undefined;
    await deletePending(connectionId(entry.sessionId, entry.serverName));
    if (message) lastError.set(connectionId(entry.sessionId, entry.serverName), message);
    return entry.serverName;
  }

  async function consumeLastError(
    sessionId: string,
    serverName: string,
  ): Promise<string | undefined> {
    const id = connectionId(sessionId, serverName);
    const message = lastError.get(id);
    lastError.delete(id);
    return message;
  }

  async function getSessionTools(sessionId: string): Promise<Record<string, McpTool>> {
    const tools: Record<string, McpTool> = {};
    for (const server of servers) {
      const entry = await connectedRepository.findById(connectionId(sessionId, server.name));
      if (entry) Object.assign(tools, entry.tools);
    }
    return tools;
  }

  async function getSessionClient(sessionId: string, serverName: string) {
    const entry = await connectedRepository.findById(connectionId(sessionId, serverName));
    return entry?.client;
  }

  async function isConnected(sessionId: string, serverName: string): Promise<boolean> {
    return (await connectedRepository.findById(connectionId(sessionId, serverName))) !== undefined;
  }

  async function closeConnection(sessionId: string, serverName: string): Promise<void> {
    const id = connectionId(sessionId, serverName);
    const entry = await connectedRepository.findById(id);
    if (!entry) return;
    await deleteConnected(id);
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
    await saveConnected(connectionId(entry.sessionId, entry.serverName), entry);
  }

  async function closeEntry(sessionId: string, serverName: string): Promise<void> {
    const id = connectionId(sessionId, serverName);
    const pendingEntry = await pendingRepository.findById(id);
    if (pendingEntry) await deletePending(id);
    lastError.delete(id);
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
        await deleteConnected(connectionId(entry.sessionId, entry.serverName));
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
    consumeLastError,
    getSessionTools,
    getSessionClient,
    isConnected,
    serverNames: servers.map((server) => server.name),
    disconnect,
    disconnectSession,
    closeAll,
  };
}
