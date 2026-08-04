import { Ion, Viewer, Terrain } from "cesium";
import { config } from "./config";

if (config.cesiumIonToken) {
  Ion.defaultAccessToken = config.cesiumIonToken;
}

// Only needed when the token above was issued by a non-production ion server (e.g. an internal or
// staging ion environment) — otherwise every asset request 401s against the default
// production api.cesium.com server, since Cesium has no way to infer the issuing server from the
// token itself.
if (config.cesiumIonServerUrl) {
  Ion.defaultServer = config.cesiumIonServerUrl;
}

export function initViewer(container: HTMLElement): Viewer {
  return new Viewer(container, {
    terrain: Terrain.fromWorldTerrain(),
    baseLayerPicker: false,
    geocoder: false,
    timeline: true,
    animation: true,
    // Cesium's default reaction to any render-loop error (e.g. AI-generated code that adds a
    // primitive with a bad style expression or invalid shader) is to show a blocking HTML panel
    // requiring the user to click "OK", on top of permanently halting the render loop regardless
    // of this setting. `execute-cesium-code.ts`'s `waitForRenderError` watches
    // `viewer.scene.renderError` itself, reports the failure back to the model, and resumes the
    // render loop — so that intrusive panel would just be redundant/confusing here.
    showRenderLoopErrors: false,
  });
}
