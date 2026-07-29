import type { PendingMcpConnection } from "./models.js";

/**
 * Generic storage abstraction shared by both connection repositories below,
 * keyed by a plain opaque `id` string (the caller decides what that id
 * means, e.g. `${sessionId}:${serverName}`; this interface doesn't need to
 * know or care). Methods may be asynchronous so a host can instrument or
 * coordinate lifecycle operations.
 */
export interface McpConnectionRepository<T> {
  findById(id: string): T | undefined | Promise<T | undefined>;
  /** Upserts `entry` under `id`. */
  save(id: string, entry: T): void | Promise<void>;
  delete(id: string): void | Promise<void>;
  listAll(): readonly T[] | Promise<readonly T[]>;
}

/**
 * Storage abstraction for in-flight OAuth connection attempts. Adds a
 * secondary lookup by the OAuth `state` value alone (for routing the
 * shared, server-name-agnostic callback route back to the right attempt) -
 * an implementation must keep both lookups in sync for the same entry, i.e.
 * `delete(id)` must remove the entry from BOTH lookups. No-op if none exists.
 *
 * `createSessionMcpManager` uses an internal in-memory implementation by
 * default. Because `PendingMcpConnection` contains a live OAuth provider,
 * this interface is process-local.
 */
export interface McpPendingConnectionRepository extends McpConnectionRepository<PendingMcpConnection> {
  findByState(
    state: string,
  ): PendingMcpConnection | undefined | Promise<PendingMcpConnection | undefined>;
}
