import type { Feature, FeatureCollection, Geometry } from "geojson";

/** Any GeoJSON value a Turf tool can store or operate on. */
export type StoredGeoJson = Feature | FeatureCollection<Geometry>;

interface StoredDataset {
  data: StoredGeoJson;
  createdAt: number;
}

/**
 * A GeoJSON dataset store, scoped per-session so concurrent users/conversations
 * never see each other's data. This directly fixes a real bug found in the
 * reference implementation (`sample_apps/turf-test`'s `dataset-store.ts`),
 * which used a single unscoped process-wide `Map` + incrementing counter that
 * was never cleared — leaking datasets across users and growing unbounded for
 * the life of the process.
 *
 * Every dataset is also evicted after {@link TurfDatasetStoreOptions.ttlMs}
 * (default 30 minutes) of inactivity, swept lazily on each call rather than a
 * background timer — this package has no reason to keep a process alive on
 * its own.
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
      if (now - entry.createdAt > ttlMs) datasets.delete(id);
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
      datasets.set(datasetId, { data, createdAt: Date.now() });
      return datasetId;
    },

    get(sessionId, datasetId) {
      const datasets = bySession.get(sessionId);
      if (!datasets) return undefined;
      sweepExpired(datasets);

      const entry = datasets.get(datasetId);
      return entry?.data;
    },

    clear(sessionId) {
      bySession.delete(sessionId);
    },

    sessionCount() {
      return bySession.size;
    },
  };
}
