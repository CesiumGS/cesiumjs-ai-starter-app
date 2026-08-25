/**
 * Guardrails the reference implementation (`sample_apps/turf-test`) was
 * missing — cheap upfront checks that reject pathological input before an
 * expensive Turf operation runs, rather than letting the process hang or run
 * away on memory.
 */

/**
 * `turf_intersect` naively calls `turf.intersect` once per (polygon-in-A,
 * polygon-in-B) pair — an O(n·m) nested loop with no size cap in the
 * reference app. Reject a request whose pair count would exceed this before
 * running any of it.
 */
export const MAX_INTERSECT_FEATURE_PAIRS = 10_000;

/**
 * `turf_hex_grid`'s optional point-aggregation step is capped on both the
 * number of generated cells and the number of points to aggregate, so a huge
 * bbox / tiny cell_side / huge point set can't produce an unbounded amount of
 * work or response payload.
 */
export const MAX_HEX_GRID_CELLS = 5_000;
export const MAX_HEX_GRID_AGGREGATE_POINTS = 50_000;
