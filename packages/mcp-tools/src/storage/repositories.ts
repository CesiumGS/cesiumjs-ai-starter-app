import type { ConnectedMcpConnection, PendingMcpConnection } from "./models.js";

/**
 * Storage abstraction for in-flight OAuth connection attempts, keyed by a
 * plain opaque `id` string (for the "already pending"/disconnect checks -
 * the caller decides what that id means, e.g. `${sessionId}:${serverName}`;
 * this interface doesn't need to know or care) plus a secondary lookup by
 * the OAuth `state` value alone (for routing the shared, server-name-agnostic
 * callback route back to the right attempt). An implementation must keep
 * both lookups in sync for the same entry.
 *
 * `createSessionMcpManager` uses an internal in-memory implementation by
 * default. Because `PendingMcpConnection` contains a live OAuth provider,
 * this interface is process-local; methods may still be asynchronous so a
 * host can instrument or coordinate lifecycle operations.
 */
export interface McpPendingConnectionRepository {
  findById(
    id: string,
  ): PendingMcpConnection | undefined | Promise<PendingMcpConnection | undefined>;
  findByState(
    state: string,
  ): PendingMcpConnection | undefined | Promise<PendingMcpConnection | undefined>;
  /** Upserts `entry` under `id`. */
  save(id: string, entry: PendingMcpConnection): void | Promise<void>;
  /** Removes the entry for `id` from BOTH lookups. No-op if none exists. */
  delete(id: string): void | Promise<void>;
}

/**
 * Storage abstraction for live, connected MCP sessions, keyed by a plain
 * opaque `id` string (same convention as {@link McpPendingConnectionRepository}).
 * See `ConnectedMcpConnection`'s doc comment (`./models.js`) for why - unlike
 * {@link McpPendingConnectionRepository} - no implementation of this
 * interface can ever be backed by anything other than process memory. This
 * package ships no concrete implementation of this one either, for the same
 * "pure abstraction" reason.
 */
export interface McpConnectedConnectionRepository {
  findById(
    id: string,
  ): ConnectedMcpConnection | undefined | Promise<ConnectedMcpConnection | undefined>;
  /** Upserts `entry` under `id`. */
  save(id: string, entry: ConnectedMcpConnection): void | Promise<void>;
  delete(id: string): void | Promise<void>;
  /** Every currently-connected entry, across every id - used only by `closeAll()`. */
  listAll(): readonly ConnectedMcpConnection[] | Promise<readonly ConnectedMcpConnection[]>;
}
