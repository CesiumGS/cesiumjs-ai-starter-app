import { tool, type Tool } from "ai";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { TurfDatasetStore } from "../dataset-store.js";
import { InvalidGeoJsonError, resolveGeoJson, UnknownDatasetError } from "../resolve-geojson.js";
import { MAX_HEX_GRID_AGGREGATE_POINTS, MAX_HEX_GRID_CELLS } from "../guardrails.js";
import { turfHexGridInputSchema } from "./turf-hex-grid.schema.js";

export { turfHexGridInputSchema } from "./turf-hex-grid.schema.js";

// Rough kilometres-per-degree at the equator, used only to size the spatial
// index's bucket grid (a perf optimization, not a precise cartographic
// conversion) — good enough since buckets only need to be "about the size of
// a cell" for the point->candidate-cells lookup below to stay cheap.
const KM_PER_DEGREE = 111;

interface CellIndexEntry {
  cellIndex: number;
  polygon: Feature<Polygon>;
}

/**
 * Builds a uniform bucket grid over `bbox` (sized to roughly one cell's
 * footprint) mapping each bucket to the hex cells whose centroid falls in it.
 * Built once in O(cells) — the guardrail this tool needed: the reference
 * implementation rescanned every point against every cell (`O(cells x points)`
 * `pointsWithinPolygon` calls); this lets each point look up its handful of
 * candidate cells directly instead.
 */
function buildCellBucketIndex(
  cells: FeatureCollection<Polygon>,
  bbox: { west: number; south: number; east: number; north: number },
  cellSideKm: number,
) {
  const bucketDeg = Math.max(cellSideKm / KM_PER_DEGREE, 1e-6);
  const buckets = new Map<string, CellIndexEntry[]>();

  const bucketKey = (lon: number, lat: number) =>
    `${Math.floor((lon - bbox.west) / bucketDeg)},${Math.floor((lat - bbox.south) / bucketDeg)}`;

  cells.features.forEach((cell, cellIndex) => {
    const [centroidLon, centroidLat] = turf.centroid(cell).geometry.coordinates;
    const key = bucketKey(centroidLon, centroidLat);
    const entry: CellIndexEntry = { cellIndex, polygon: cell };
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  });

  return {
    /** Candidate cells for a point, drawn from its own bucket plus the 8 neighbors. */
    candidatesFor(lon: number, lat: number): CellIndexEntry[] {
      const col = Math.floor((lon - bbox.west) / bucketDeg);
      const row = Math.floor((lat - bbox.south) / bucketDeg);
      const candidates: CellIndexEntry[] = [];
      for (let dCol = -1; dCol <= 1; dCol++) {
        for (let dRow = -1; dRow <= 1; dRow++) {
          const bucket = buckets.get(`${col + dCol},${row + dRow}`);
          if (bucket) candidates.push(...bucket);
        }
      }
      return candidates;
    },
  };
}

/**
 * Cheap upper-bound estimate of the hex grid's cell count *before* calling
 * `turf.hexGrid`, so a huge bbox / tiny `cell_side` (e.g. the whole globe at
 * meter-scale cells) can be rejected without paying for the — potentially
 * enormous — generation itself. Deliberately approximate (packing/boundary
 * effects aren't modeled, and this is plain degree-to-km arithmetic rather
 * than geodesic distance — `turf.distance` between the bbox's own west/east
 * edges degenerates to ~0 once the span approaches 360°, since -180°/180°
 * are the same meridian); the exact post-generation check below remains the
 * authoritative guard for borderline cases.
 */
function estimateHexGridCellCount(
  bbox: { west: number; south: number; east: number; north: number },
  cellSideKm: number,
): number {
  const midLatRad = ((bbox.south + bbox.north) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(bbox.east - bbox.west) * KM_PER_DEGREE * Math.cos(midLatRad);
  const heightKm = Math.abs(bbox.north - bbox.south) * KM_PER_DEGREE;
  const hexAreaKm2 = (3 * Math.sqrt(3) * cellSideKm ** 2) / 2;
  if (hexAreaKm2 <= 0) return Infinity;
  return (widthKm * heightKm) / hexAreaKm2;
}

/**
 * `turf_hex_grid` — a hexagonal grid over a bounding box, optionally
 * aggregating point density/values per cell (heatmaps). Both the grid size
 * and the optional aggregation input are capped ({@link MAX_HEX_GRID_CELLS},
 * {@link MAX_HEX_GRID_AGGREGATE_POINTS}) before any work runs.
 */
export function createTurfHexGridTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Generate a hexagonal grid over a bounding box, optionally aggregating point density or a " +
      "numeric property per cell (e.g. a facility-density heatmap). Returns a new dataset_id for " +
      "the resulting hex FeatureCollection.",
    inputSchema: turfHexGridInputSchema,
    execute: async ({ bbox, cell_side, points_to_aggregate, aggregate_property }) => {
      try {
        const estimatedCells = estimateHexGridCellCount(bbox, cell_side);
        if (estimatedCells > MAX_HEX_GRID_CELLS) {
          return {
            error:
              `Requested hex grid would produce approximately ${Math.round(estimatedCells)} ` +
              `cells, exceeding the ${MAX_HEX_GRID_CELLS}-cell limit. Increase cell_side or ` +
              "shrink the bbox.",
          };
        }

        const grid = turf.hexGrid([bbox.west, bbox.south, bbox.east, bbox.north], cell_side, {
          units: "kilometers",
        }) as FeatureCollection<Polygon>;

        if (grid.features.length > MAX_HEX_GRID_CELLS) {
          return {
            error:
              `Requested hex grid would produce ${grid.features.length} cells, exceeding the ` +
              `${MAX_HEX_GRID_CELLS}-cell limit. Increase cell_side or shrink the bbox.`,
          };
        }

        if (!points_to_aggregate) {
          const datasetId = store.set(sessionId, grid);
          return { dataset_id: datasetId, cell_count: grid.features.length };
        }

        const points = resolveGeoJson(
          points_to_aggregate,
          store,
          sessionId,
        ) as FeatureCollection<Point>;
        if (points.features.length > MAX_HEX_GRID_AGGREGATE_POINTS) {
          return {
            error:
              `points_to_aggregate has ${points.features.length} points, exceeding the ` +
              `${MAX_HEX_GRID_AGGREGATE_POINTS}-point aggregation limit.`,
          };
        }

        const index = buildCellBucketIndex(grid, bbox, cell_side);
        const counts = new Array<number>(grid.features.length).fill(0);
        const sums = new Array<number>(grid.features.length).fill(0);

        for (const point of points.features) {
          const [lon, lat] = point.geometry.coordinates;
          const candidates = index.candidatesFor(lon, lat);
          const match = candidates.find((candidate) =>
            turf.booleanPointInPolygon(point, candidate.polygon),
          );
          if (!match) continue;

          counts[match.cellIndex]++;
          if (aggregate_property) {
            const rawValue = point.properties?.[aggregate_property];
            if (typeof rawValue === "number") sums[match.cellIndex] += rawValue;
          }
        }

        const aggregated: FeatureCollection<Polygon> = turf.featureCollection(
          grid.features.map((cell, cellIndex) => ({
            ...cell,
            properties: {
              ...cell.properties,
              point_count: counts[cellIndex],
              ...(aggregate_property ? { [`${aggregate_property}_sum`]: sums[cellIndex] } : {}),
            },
          })),
        );

        const datasetId = store.set(sessionId, aggregated);
        return { dataset_id: datasetId, cell_count: aggregated.features.length };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}
