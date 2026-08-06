import {
  ArcGisMapServerImageryProvider,
  BingMapsImageryProvider,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  Rectangle,
  SingleTileImageryProvider,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  type ImageryProvider,
} from "cesium";
import {
  imageryAddInputShape,
  imageryListInputShape,
  imageryRemoveInputShape,
  type ImageryAddInput,
} from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { success, failure } from "../utils/result.js";
import {
  findImageryLayerByName,
  forgetImageryLayer,
  getImageryLayerName,
  registerImageryLayerName,
} from "../utils/imagery-registry.js";
import type { ToolExecutor } from "../types.js";

/**
 * Builds the real `ImageryProvider` for each supported `imageryAdd.type`.
 * Exported so a host can extend it with additional provider types (this
 * default doesn't implement `GoogleEarthEnterpriseImageryProvider` — its
 * metadata-then-construct flow is a different shape than every other
 * provider here) without forking the whole `imageryAdd` executor.
 */
export const IMAGERY_PROVIDER_FACTORIES: Record<
  ImageryAddInput["type"],
  (args: ImageryAddInput) => ImageryProvider | Promise<ImageryProvider>
> = {
  UrlTemplateImageryProvider: (args) => new UrlTemplateImageryProvider({ url: args.url }),
  WebMapServiceImageryProvider: (args) =>
    new WebMapServiceImageryProvider({
      url: args.url,
      layers: args.layers ?? "",
      parameters: args.style ? { styles: args.style } : undefined,
    }),
  WebMapTileServiceImageryProvider: (args) =>
    new WebMapTileServiceImageryProvider({
      url: args.url,
      layer: args.layers ?? "",
      style: args.style ?? "default",
      format: args.format ?? "image/jpeg",
      tileMatrixSetID: args.tileMatrixSetID ?? "",
    }),
  ArcGisMapServerImageryProvider: (args) => ArcGisMapServerImageryProvider.fromUrl(args.url),
  BingMapsImageryProvider: (args) =>
    BingMapsImageryProvider.fromUrl(args.url, { key: args.key ?? "" }),
  TileMapServiceImageryProvider: (args) => TileMapServiceImageryProvider.fromUrl(args.url),
  OpenStreetMapImageryProvider: (args) => new OpenStreetMapImageryProvider({ url: args.url }),
  IonImageryProvider: (args) => {
    if (args.assetId === undefined) {
      throw new Error("imageryAdd: IonImageryProvider requires an assetId.");
    }
    return IonImageryProvider.fromAssetId(args.assetId);
  },
  SingleTileImageryProvider: (args) =>
    SingleTileImageryProvider.fromUrl(args.url, {
      rectangle: args.rectangle
        ? Rectangle.fromDegrees(
            args.rectangle.west,
            args.rectangle.south,
            args.rectangle.east,
            args.rectangle.north,
          )
        : undefined,
    }),
  GoogleEarthEnterpriseImageryProvider: () => {
    throw new Error(
      "imageryAdd: GoogleEarthEnterpriseImageryProvider isn't implemented by default — " +
        "override IMAGERY_PROVIDER_FACTORIES.GoogleEarthEnterpriseImageryProvider to add it.",
    );
  },
};

/** Default `imageryAdd` executor: constructs the provider then adds it as a new imagery layer. */
export const imageryAdd: ToolExecutor = async (viewer, rawArgs) => {
  const parsed = parseArgs(imageryAddInputShape, rawArgs);
  if (!parsed.ok) return failure(`Invalid imageryAdd arguments: ${parsed.error}`);

  try {
    const provider = await IMAGERY_PROVIDER_FACTORIES[parsed.data.type](parsed.data);
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    if (parsed.data.alpha !== undefined) layer.alpha = parsed.data.alpha;
    if (parsed.data.show !== undefined) layer.show = parsed.data.show;
    const name = parsed.data.name ?? parsed.data.type;
    registerImageryLayerName(viewer, layer, name);
    return success({ name, index: viewer.imageryLayers.indexOf(layer) });
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
};

/** Default `imageryRemove` executor: removes by index, by name, or clears every layer. */
export const imageryRemove: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(imageryRemoveInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid imageryRemove arguments: ${parsed.error}`));
  const { index, name, removeAll } = parsed.data;

  if (removeAll) {
    viewer.imageryLayers.removeAll();
    return Promise.resolve(success());
  }

  const layer =
    index !== undefined
      ? viewer.imageryLayers.get(index)
      : name !== undefined
        ? findImageryLayerByName(viewer, name)
        : undefined;

  if (!layer) return Promise.resolve(failure("No matching imagery layer found to remove."));
  viewer.imageryLayers.remove(layer);
  forgetImageryLayer(viewer, layer);
  return Promise.resolve(success());
};

/** Default `imageryList` executor. */
export const imageryList: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(imageryListInputShape, rawArgs);
  if (!parsed.ok) return Promise.resolve(failure(`Invalid imageryList arguments: ${parsed.error}`));

  const layers: Record<string, unknown>[] = [];
  for (let index = 0; index < viewer.imageryLayers.length; index++) {
    const layer = viewer.imageryLayers.get(index);
    const entry: Record<string, unknown> = {
      index,
      name: getImageryLayerName(viewer, layer) ?? `layer-${index}`,
      show: layer.show,
    };
    if (parsed.data.includeDetails) entry.alpha = layer.alpha;
    layers.push(entry);
  }
  return Promise.resolve(success({ layers }));
};
