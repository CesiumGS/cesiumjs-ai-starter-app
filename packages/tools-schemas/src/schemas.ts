/**
 * Aggregates every tool's structural input shape — no model-facing description
 * text — behind the package's `/schemas` subpath. This file imports only
 * `zod`-based shape modules, never `ai` or a tool's description strings, so the
 * frontend can import it to validate untrusted tool-call args without pulling
 * tool *definitions* into the client bundle. Add a re-export here for every new
 * tool's schema module under `./tools/<toolName>/<toolName>.schema.js`.
 */
export { flyToInputShape, type FlyToInput } from "./tools/flyTo/flyTo.schema.js";
export {
  cameraSetViewInputShape,
  type CameraSetViewInput,
} from "./tools/cameraSetView/cameraSetView.schema.js";
export {
  cameraLookAtTransformInputShape,
  type CameraLookAtTransformInput,
} from "./tools/cameraLookAtTransform/cameraLookAtTransform.schema.js";
export {
  cameraStartOrbitInputShape,
  type CameraStartOrbitInput,
} from "./tools/cameraStartOrbit/cameraStartOrbit.schema.js";
export {
  cameraStopOrbitInputShape,
  type CameraStopOrbitInput,
} from "./tools/cameraStopOrbit/cameraStopOrbit.schema.js";
export {
  cameraGetPositionInputShape,
  type CameraGetPositionInput,
} from "./tools/cameraGetPosition/cameraGetPosition.schema.js";
export {
  cameraSetControllerOptionsInputShape,
  type CameraSetControllerOptionsInput,
} from "./tools/cameraSetControllerOptions/cameraSetControllerOptions.schema.js";
export {
  entityAddPointInputShape,
  type EntityAddPointInput,
} from "./tools/entityAddPoint/entityAddPoint.schema.js";
export {
  entityAddBillboardInputShape,
  type EntityAddBillboardInput,
} from "./tools/entityAddBillboard/entityAddBillboard.schema.js";
export {
  entityAddLabelInputShape,
  type EntityAddLabelInput,
} from "./tools/entityAddLabel/entityAddLabel.schema.js";
export {
  entityAddModelInputShape,
  type EntityAddModelInput,
} from "./tools/entityAddModel/entityAddModel.schema.js";
export {
  entityAddPolygonInputShape,
  type EntityAddPolygonInput,
} from "./tools/entityAddPolygon/entityAddPolygon.schema.js";
export {
  entityAddPolylineInputShape,
  type EntityAddPolylineInput,
} from "./tools/entityAddPolyline/entityAddPolyline.schema.js";
export {
  entityAddBoxInputShape,
  type EntityAddBoxInput,
} from "./tools/entityAddBox/entityAddBox.schema.js";
export {
  entityAddCorridorInputShape,
  type EntityAddCorridorInput,
} from "./tools/entityAddCorridor/entityAddCorridor.schema.js";
export {
  entityAddCylinderInputShape,
  type EntityAddCylinderInput,
} from "./tools/entityAddCylinder/entityAddCylinder.schema.js";
export {
  entityAddEllipseInputShape,
  type EntityAddEllipseInput,
} from "./tools/entityAddEllipse/entityAddEllipse.schema.js";
export {
  entityAddRectangleInputShape,
  type EntityAddRectangleInput,
} from "./tools/entityAddRectangle/entityAddRectangle.schema.js";
export {
  entityAddWallInputShape,
  type EntityAddWallInput,
} from "./tools/entityAddWall/entityAddWall.schema.js";
export {
  entityListInputShape,
  type EntityListInput,
} from "./tools/entityList/entityList.schema.js";
export {
  entityRemoveInputShape,
  type EntityRemoveInput,
} from "./tools/entityRemove/entityRemove.schema.js";
export {
  animationCreateInputShape,
  type AnimationCreateInput,
} from "./tools/animationCreate/animationCreate.schema.js";
export {
  animationControlInputShape,
  type AnimationControlInput,
} from "./tools/animationControl/animationControl.schema.js";
export {
  animationRemoveInputShape,
  type AnimationRemoveInput,
} from "./tools/animationRemove/animationRemove.schema.js";
export {
  animationListActiveInputShape,
  type AnimationListActiveInput,
} from "./tools/animationListActive/animationListActive.schema.js";
export {
  animationUpdatePathInputShape,
  type AnimationUpdatePathInput,
} from "./tools/animationUpdatePath/animationUpdatePath.schema.js";
export {
  animationCameraTrackingInputShape,
  type AnimationCameraTrackingInput,
} from "./tools/animationCameraTracking/animationCameraTracking.schema.js";
export {
  clockControlInputShape,
  type ClockControlInput,
} from "./tools/clockControl/clockControl.schema.js";
export {
  globeSetLightingInputShape,
  type GlobeSetLightingInput,
} from "./tools/globeSetLighting/globeSetLighting.schema.js";
export {
  imageryAddInputShape,
  type ImageryAddInput,
} from "./tools/imageryAdd/imageryAdd.schema.js";
export {
  imageryRemoveInputShape,
  type ImageryRemoveInput,
} from "./tools/imageryRemove/imageryRemove.schema.js";
export {
  imageryListInputShape,
  type ImageryListInput,
} from "./tools/imageryList/imageryList.schema.js";
