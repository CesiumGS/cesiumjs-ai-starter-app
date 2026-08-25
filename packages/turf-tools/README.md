# @cesium-ai/turf-tools

Server-only [Turf.js](https://turfjs.org/) spatial-analysis tools for the AI SDK agent loop, backed
by a session-scoped GeoJSON dataset store.

Unlike the viewer tools in [`@cesium-ai/tools-schemas`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/tools-schemas/README.md) (schema-only,
executed client-side against a live `Viewer`), these tools have **no `Viewer` dependency at all** —
each one runs a Turf.js operation entirely in-process on the backend and returns a plain JSON
result. Reference implementation reviewed:
[`iTwin/cesium-ai-agentic-workflows`'s `sample_apps/turf-test`](https://github.com/iTwin/cesium-ai-agentic-workflows/tree/main/sample_apps/turf-test)
— this package fixes a couple of real bugs found there (see below).

## Tools

| Tool name                    | Turf function(s)                     | Purpose                                                                   |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `turf_register_dataset`      | —                                    | Stores a GeoJSON Feature/FeatureCollection, returning a `dataset_id`      |
| `turf_get_dataset`           | —                                    | Resolves a `dataset_id` back to its full GeoJSON (e.g. to render it)      |
| `turf_buffer`                | `turf.buffer`                        | Buffer polygons around features — flood/risk zones, proximity areas       |
| `turf_points_within_polygon` | `turf.pointsWithinPolygon`           | Which points fall inside polygon(s) — facility counts, POIs in a district |
| `turf_intersect`             | `turf.intersect`                     | Overlap between two polygon layers                                        |
| `turf_area`                  | `turf.area`                          | Total area of polygon features                                            |
| `turf_hex_grid`              | `turf.hexGrid` (+ point aggregation) | Hexagonal grid over a bbox, optionally aggregating point density/values   |

Every GeoJSON-shaped input accepts **either** an inline Feature/FeatureCollection **or** a
`{ dataset_id }` reference to a dataset returned by an earlier call — never pass a large
FeatureCollection through tool-call arguments/LLM context more than once. Chain tools by passing
the previous call's `dataset_id` into the next one (e.g. `turf_buffer` → `turf_points_within_polygon`).
Use `turf_get_dataset` only at the point the actual GeoJSON needs to leave the store — typically to
render it (see below).

## Session-scoped dataset store

`createTurfDatasetStore()` returns a `TurfDatasetStore` keyed `sessionId -> datasetId -> GeoJSON`,
with idle datasets evicted after a configurable TTL (default 30 minutes). This directly fixes a
real bug in the reference implementation, whose `dataset-store.ts` was an **unscoped global
singleton** — a single `Map` + incrementing counter shared by every request, never cleared. That
leaks datasets across concurrent users/sessions and grows unbounded for the life of the process.

`createTurfTools(store, sessionId)` binds one session's worth of tools — call it once per request
with that request's own session id (mirroring this repo's `createExecuteCesiumCodeTool` per-request
factory pattern), never once at server startup.

**Not production-ready as-is for multi-instance deployments**: `createTurfDatasetStore()` is an
in-process `Map`, with no pluggable backend (unlike `@cesium-ai/mcp-tools`'s
`McpConnectionRepository<T>`). A dataset is only visible to whichever backend instance created it,
and every dataset is lost on restart. Fine for local dev / a single instance behind sticky sessions;
a deployment with multiple replicas needs either sticky sessions pinning a browser session to one
instance, or this store swapped for a shared low-latency backend (e.g. Redis, which also gives
native per-key TTL matching this store's idle-eviction semantics) — plain Blob/object storage is a
poor fit given how frequently a chained sequence of Turf tool calls reads/writes the same dataset
within one turn.

**Temp vs. long-lived data — different requirements, different stores**: this store is only for
ephemeral, in-session working data (registered/intermediate results a chained sequence of tool
calls reads and writes within one conversation). It is not a place to persist a dataset a user
wants to keep beyond the session (export, save-for-later, share a link) — that's a separate,
low-frequency, durability-matters need better served by Blob storage, added as an explicit
save/export action rather than folded into this store. Don't reach for local/temp files on disk
for either case: many container platforms give no persistent-disk guarantee at all (a restart or
new replica can lose them outright), so files solve neither the multi-instance problem above nor
long-term persistence any better than the alternatives already named.

**Process memory considerations**: there is currently no cap on an individual dataset's size or on
the store's total memory footprint — unlike `turf_intersect`/`turf_hex_grid`'s explicit guardrails
below, `turf_register_dataset` accepts any size of GeoJSON and holds it in process memory until the
idle-TTL sweep runs. A conversation that registers several large `FeatureCollection`s in quick
succession can grow backend memory usage well before the 30-minute default TTL clears anything.
Worth adding a per-dataset size cap (mirroring the existing guardrails pattern) if this is used with
untrusted or unbounded input.

## Guardrails

The reference implementation was missing size caps on a couple of operations that can blow up
quadratically or silently misreport:

- `turf_intersect` rejects a request whose `features1.length * features2.length` exceeds
  `MAX_INTERSECT_FEATURE_PAIRS` (10,000) before running any `turf.intersect` calls.
- `turf_hex_grid`'s optional point-aggregation indexes points into a spatial bucket grid in one
  pass (`O(cells + points)`) instead of rescanning every point against every cell
  (`O(cells x points)`), and caps both cell count (`MAX_HEX_GRID_CELLS`) and aggregated point count
  (`MAX_HEX_GRID_AGGREGATE_POINTS`).
- `turf_area` returns an explicit `{ error }` when the input has no Polygon/MultiPolygon features,
  instead of silently returning `0` (indistinguishable from a real, zero-area polygon).

## Rendering Turf output on the globe

This package only produces/stores GeoJSON — it doesn't render anything itself. To show a Turf
result on the live `Viewer`, call `turf_get_dataset` to resolve a `dataset_id` back to its full
GeoJSON, then pass that straight into `@cesium-ai/tools-schemas`' `geoJsonAdd` tool (client-side,
loads it via `Cesium.GeoJsonDataSource.load`) — e.g. `turf_buffer` → `turf_get_dataset` →
`geoJsonAdd`. `geoJsonRemove` removes a previously added GeoJSON data source by name, or all of
them at once. See the [tool catalogue](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/tools-schemas/tools/)
for both tools' full schemas.

### Example prompt: wildfire evacuation zones

A single prompt chaining `entityAdd` → `turf_buffer` (x3) → `geoJsonAdd` (x3) →
`turf_points_within_polygon` → `globeSetLighting` → `flyTo` → `cameraOrbit` — concentric colored
risk zones around a fire origin, checked against real evacuation-center points, with lighting and
an orbiting camera for a visually compelling recording:

```
A wildfire has started at latitude 34.1341, longitude -118.3215 (near the Hollywood Hills, LA).
Mark the origin with entityAdd, labeled "Fire Origin". Using turf_buffer three times, create a
2km "danger zone", a 5km "warning zone", and a 10km "watch zone" around it. Render them with
geoJsonAdd as three separate layers: danger zone in red, warning zone in orange, watch zone in
yellow, each with some transparency so the rings are visible through each other. Then, using
turf_points_within_polygon, check which of these evacuation centers fall inside the danger zone:
Griffith Observatory (-118.3004, 34.1184), Hollywood Bowl (-118.3390, 34.1122), and Universal
Studios (-118.3538, 34.1381). Enable realistic sun lighting with globeSetLighting, fly the camera
to the fire origin with flyTo, then slowly orbit around it with cameraOrbit so all three zones
are visible.
```

## Wiring into an app

```ts
import { createTurfDatasetStore, createTurfTools } from "@cesium-ai/turf-tools";

const turfDatasetStore = createTurfDatasetStore({ ttlMs: 30 * 60 * 1000 });

// Per-request — req.sessionID requires session middleware to be mounted.
const tools = {
  ...otherTools,
  ...createTurfTools(turfDatasetStore, req.sessionID),
};
```

See `backend/src/app.ts` for how this app wires it in behind the `ENABLE_TURF_TOOLS` env var,
reusing the same session middleware as session-scoped MCP connections.
