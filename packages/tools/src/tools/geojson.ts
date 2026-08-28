import { Color, GeoJsonDataSource } from "cesium";
import { geoJsonAddInputShape, geoJsonRemoveInputShape } from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { success, failure } from "../utils/result.js";
import type { ToolExecutor } from "../types.js";

/** Default `geoJsonAdd` executor: loads the GeoJSON and adds it as a new data source. */
export const geoJsonAdd: ToolExecutor = async (viewer, rawArgs) => {
  const parsed = parseArgs(geoJsonAddInputShape, rawArgs);
  if (!parsed.ok) return failure(`Invalid geoJsonAdd arguments: ${parsed.error}`);

  const { geojson, name, stroke, fill, strokeWidth, clampToGround, markerColor } = parsed.data;

  try {
    const dataSource = await GeoJsonDataSource.load(geojson, {
      stroke: stroke ? Color.fromCssColorString(stroke) : undefined,
      fill: fill ? Color.fromCssColorString(fill) : undefined,
      strokeWidth,
      clampToGround,
      markerColor: markerColor ? Color.fromCssColorString(markerColor) : undefined,
    });
    // Falls back to a unique default rather than Cesium's own "" so geoJsonRemove
    // can always find this data source back by name.
    dataSource.name = name ?? `geojson-${Date.now()}`;
    await viewer.dataSources.add(dataSource);
    return success({ name: dataSource.name, entityCount: dataSource.entities.values.length });
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
};

/** Default `geoJsonRemove` executor: removes by name, or clears every GeoJSON data source. */
export const geoJsonRemove: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(geoJsonRemoveInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid geoJsonRemove arguments: ${parsed.error}`));
  const { name, removeAll } = parsed.data;

  // Only ever touches GeoJsonDataSource instances — never a KML/CZML data
  // source some other tool might have added to the same viewer.dataSources
  // collection.
  const geoJsonDataSources: GeoJsonDataSource[] = [];
  for (let i = 0; i < viewer.dataSources.length; i++) {
    const ds = viewer.dataSources.get(i);
    if (ds instanceof GeoJsonDataSource) geoJsonDataSources.push(ds);
  }

  if (removeAll) {
    for (const ds of geoJsonDataSources) viewer.dataSources.remove(ds);
    return Promise.resolve(success());
  }

  if (name === undefined) {
    return Promise.resolve(failure("geoJsonRemove requires either name or removeAll."));
  }

  const match = geoJsonDataSources.find((ds) => ds.name === name);
  if (!match) return Promise.resolve(failure(`No GeoJSON data source named "${name}" found.`));

  viewer.dataSources.remove(match);
  return Promise.resolve(success());
};
