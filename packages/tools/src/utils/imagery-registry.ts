import type { ImageryLayer, Viewer } from "cesium";

/**
 * `ImageryLayer` has no `name` property of its own, but `imageryAdd`'s schema
 * accepts one and `imageryList`/`imageryRemove` need to look layers up by it —
 * this per-`Viewer` registry (a `WeakMap` so nothing leaks once a `Viewer` is
 * destroyed) is where that name actually lives.
 */
const namesByViewer = new WeakMap<Viewer, Map<ImageryLayer, string>>();

export function registerImageryLayerName(viewer: Viewer, layer: ImageryLayer, name: string): void {
  getNames(viewer).set(layer, name);
}

export function getImageryLayerName(viewer: Viewer, layer: ImageryLayer): string | undefined {
  return getNames(viewer).get(layer);
}

export function findImageryLayerByName(viewer: Viewer, name: string): ImageryLayer | undefined {
  for (const [layer, layerName] of getNames(viewer)) {
    if (layerName === name) return layer;
  }
  return undefined;
}

export function forgetImageryLayer(viewer: Viewer, layer: ImageryLayer): void {
  getNames(viewer).delete(layer);
}

function getNames(viewer: Viewer): Map<ImageryLayer, string> {
  let names = namesByViewer.get(viewer);
  if (!names) {
    names = new Map();
    namesByViewer.set(viewer, names);
  }
  return names;
}
