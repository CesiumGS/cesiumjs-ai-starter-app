import type { Viewer } from "cesium";
import * as CesiumNamespace from "cesium";
import { buildCesiumAsyncFactoryGuestPrelude } from "./cesium-async-factories.js";
import { createProxiedViewer } from "./guarded-viewer-proxy.js";
import { buildCesiumHostBridgeGuestPrelude } from "./guest-prelude-host-bridge.js";
import { buildCesiumStaticFallbackGuestPrelude } from "./guest-prelude-static-fallback.js";
import { buildCesiumValueTypeGuestPrelude } from "./guest-prelude-value-types.js";
import { buildViewerAsyncMethodGuestPrelude } from "./guest-prelude-viewer-async.js";
import type { SandboxHandles } from "./sandbox-handles.js";

const SAFE_STATIC_CESIUM_EXPORTS = new Set([
  "Appearance",
  "BoundingSphere",
  "CustomShader",
  "Ellipsoid",
  "GeoJsonPrimitive",
  "HeadingPitchRange",
  "ImageryLayer",
  "Ion",
  "JulianDate",
  "Material",
  "MaterialAppearance",
  "Matrix4",
  "ModelAnimationLoop",
  "ParticleSystem",
  "PinBuilder",
  "PolygonGeometry",
  "Primitive",
  "Rectangle",
  "RectangleGeometry",
  "SampledPositionProperty",
  "SampledProperty",
  "SceneMode",
  "ScreenSpaceEventType",
  "Sun",
  "SunLight",
  "Transforms",
  "WebMapServiceImageryProvider",
]);

const SAFE_CESIUM_NAMESPACE = Object.freeze(
  Object.fromEntries(
    Object.entries(CesiumNamespace).filter(([name]) => SAFE_STATIC_CESIUM_EXPORTS.has(name)),
  ),
);

/**
 * Creates the root handles and assembles the complete guest-side binding prelude in dependency
 * order. This is the single composition point for code that becomes visible inside QuickJS.
 */
export function buildCesiumGuestPrelude(
  viewer: Viewer,
  handles: SandboxHandles,
  maxItemsPerCollection?: number,
): string {
  const viewerHandleId = handles.wrapRoot(
    createProxiedViewer(viewer, { maxItemsPerCollection }),
  );
  const staticCesiumHandleId = handles.wrapRoot(SAFE_CESIUM_NAMESPACE);

  return [
    buildCesiumValueTypeGuestPrelude(),
    buildCesiumHostBridgeGuestPrelude(),
    buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId),
    buildCesiumAsyncFactoryGuestPrelude(),
    buildViewerAsyncMethodGuestPrelude(viewerHandleId),
  ].join("\n");
}