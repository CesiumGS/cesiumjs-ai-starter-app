import type { Feature, FeatureCollection, Geometry } from "geojson";

/** Any GeoJSON value a Turf tool can store or operate on. */
export type StoredGeoJson = Feature | FeatureCollection<Geometry>;

interface StoredDataset {
  data: StoredGeoJson;
  lastAccessedAt: number;
}

/**
 * A GeoJSON dataset store, scoped per-session so concurrent users/conversations
 * never see each other's data — never a single unscoped process-wide `Map`
 * shared by every request, which would leak datasets across users and grow
 * unbounded for the life of the process.
 *
 * Every dataset is also evicted after {@link TurfDatasetStoreOptions.ttlMs}
 * (default 30 minutes) of inactivity — `get()` refreshes a dataset's idle
 * timer, so only genuinely-idle data is dropped, not anything still being
 * actively chained through tool calls. Eviction is swept lazily on each call
 * rather than a background timer, since this package has no reason to keep a
 * process alive on its own; a session that's never called again after its
 * data goes idle keeps a small residual entry until the process restarts.
 */
export interface TurfDatasetStore {
  /** Stores `data` under a new id scoped to `sessionId`, returning that id. */
  set(sessionId: string, data: StoredGeoJson): string;
  /** Looks up a previously stored dataset by id, scoped to `sessionId`. */
  get(sessionId: string, datasetId: string): StoredGeoJson | undefined;
  /** Drops every dataset for `sessionId` (e.g. on logout/session destroy). */
  clear(sessionId: string): void;
  /** Total number of live sessions currently holding at least one dataset. Test/introspection only. */
  sessionCount(): number;
}

export interface TurfDatasetStoreOptions {
  /** Idle time-to-live per dataset, in milliseconds. Default 30 minutes. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** Creates a fresh, empty {@link TurfDatasetStore}. */
export function createTurfDatasetStore(options: TurfDatasetStoreOptions = {}): TurfDatasetStore {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const bySession = new Map<string, Map<string, StoredDataset>>();
  let nextId = 1;

  function sweepExpired(datasets: Map<string, StoredDataset>): void {
    const now = Date.now();
    for (const [id, entry] of datasets) {
      if (now - entry.lastAccessedAt > ttlMs) datasets.delete(id);
    }
  }

  return {
    set(sessionId, data) {
      let datasets = bySession.get(sessionId);
      if (!datasets) {
        datasets = new Map();
        bySession.set(sessionId, datasets);
      }
      sweepExpired(datasets);

      const datasetId = `ds_${nextId++}`;
      datasets.set(datasetId, { data, lastAccessedAt: Date.now() });
      return datasetId;
    },

    get(sessionId, datasetId) {
      const datasets = bySession.get(sessionId);
      if (!datasets) return undefined;
      sweepExpired(datasets);
      if (datasets.size === 0) {
        // Nothing left for this session — drop its (now-empty) map too, instead
        // of leaking one Map per session forever for sessions never revisited.
        bySession.delete(sessionId);
        return undefined;
      }

      const entry = datasets.get(datasetId);
      if (!entry) return undefined;

      entry.lastAccessedAt = Date.now();
      return entry.data;
    },

    clear(sessionId) {
      bySession.delete(sessionId);
    },

    sessionCount() {
      return bySession.size;
    },
  };
}
