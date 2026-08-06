# Tool Catalogue

All tools defined in `@cesium-ai/tools-schemas`. See the [Cesium Viewer Tools Tutorial](../../tutorials/cesium-viewer-tools-tutorial.md) for how
to enable them in the starter app.

## Camera

| Name                         | What it does                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `flyTo`                      | Animated camera flight to a geographic location                                  |
| `cameraSetView`              | Instant hard-cut to a position (no animation)                                    |
| `cameraLookAtTransform`      | Lock the camera to look at a fixed target                                        |
| `cameraOrbit`                | Start or stop an automated orbit around the current look-at target, via `action` |
| `cameraGetPosition`          | Return the current position, orientation, view rect                              |
| `cameraSetControllerOptions` | Configure movement constraints (zoom limits, etc.)                               |

## Entity

| Name           | What it does                                                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityAdd`    | Add an entity to the scene. A single discriminated-union tool: the model picks `type` (`point`, `billboard`, `label`, `model`, `polygon`, `polyline`, `box`, `corridor`, `cylinder`, `ellipse`, `rectangle`, or `wall`) and supplies matching `data` for that variant. |
| `entityList`   | List all entities currently in the scene                                                                                                                                                                                                                               |
| `entityRemove` | Remove an entity by id                                                                                                                                                                                                                                                 |

## Animation

| Name                      | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `animationCreate`         | Create a model moving along a path with timestamps |
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
