# Tool Catalogue

All tools defined in `@cesium-ai/tools-schemas`. See the [Cesium Viewer Tools Tutorial](../../tutorials/cesium-viewer-tools-tutorial.md) for how
to enable them in the starter app.

## Camera

| Name                         | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `flyTo`                      | Animated camera flight to a geographic location     |
| `cameraSetView`              | Instant hard-cut to a position (no animation)       |
| `cameraLookAtTransform`      | Lock the camera to look at a fixed target           |
| `cameraStartOrbit`           | Begin an automated orbit around a target            |
| `cameraStopOrbit`            | Stop an active orbit                                |
| `cameraGetPosition`          | Return the current position, orientation, view rect |
| `cameraSetControllerOptions` | Configure movement constraints (zoom limits, etc.)  |

## Entity

| Name                 | What it does                                 |
| -------------------- | -------------------------------------------- |
| `entityAddPoint`     | Add a point entity                           |
| `entityAddBillboard` | Add a billboard (image pinned to a position) |
| `entityAddLabel`     | Add a text label                             |
| `entityAddModel`     | Add a 3D model (glTF / glb)                  |
| `entityAddPolygon`   | Add a filled polygon                         |
| `entityAddPolyline`  | Add a polyline                               |
| `entityAddBox`       | Add a box shape                              |
| `entityAddCorridor`  | Add a corridor along a path                  |
| `entityAddCylinder`  | Add a cylinder                               |
| `entityAddEllipse`   | Add an ellipse / circle                      |
| `entityAddRectangle` | Add a rectangle                              |
| `entityAddWall`      | Add a wall following a path                  |
| `entityList`         | List all entities currently in the scene     |
| `entityRemove`       | Remove an entity by id                       |

## Animation

| Name                      | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `animationCreate`         | Create a model moving along a path with timestamps |
| `animationControl`        | Play or pause an animation                         |
| `animationRemove`         | Remove an animation                                |
| `animationListActive`     | List all active animations and clock state         |
| `animationUpdatePath`     | Update a path trail's visual appearance            |
| `animationCameraTracking` | Make the camera follow an animated entity          |

## Globe / Clock / Imagery

| Name               | What it does                        |
| ------------------ | ----------------------------------- |
| `clockControl`     | Control the Cesium simulation clock |
| `globeSetLighting` | Toggle or configure globe lighting  |
| `imageryAdd`       | Add an imagery layer                |
| `imageryRemove`    | Remove an imagery layer             |
| `imageryList`      | List all active imagery layers      |
