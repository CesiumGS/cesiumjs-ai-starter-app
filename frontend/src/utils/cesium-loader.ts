import { Ion, Viewer, Terrain } from "cesium";
import { config } from "./config";

if (config.cesiumIonToken) {
  Ion.defaultAccessToken = config.cesiumIonToken;
}

export function initViewer(container: HTMLElement): Viewer {
  return new Viewer(container, {
    terrain: Terrain.fromWorldTerrain(),
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
  });
}
