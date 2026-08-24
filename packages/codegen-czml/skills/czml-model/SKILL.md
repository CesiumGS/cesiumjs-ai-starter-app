---
name: czml-model
description: "CZML 3D models (glTF) for vehicles, aircraft, spacecraft, or any 3D asset placed on the globe, including per-node transformations and Model Articulations for jointed or moving parts. Use when the intent describes a 3D model, glTF asset, vehicle/aircraft/rocket model, or a model with moving, articulated, or transformed parts."
---

# CZML Model

- "model": `{ "gltf": "<URI or data URI>", "scale": <number>, "minimumPixelSize": <number>,
"maximumScale": <number>, "show": true|false }` — a 3D glTF model positioned and oriented by the
  entity's "position"/"orientation". When the intent asks for a 3D model, always include this
  property; do not substitute a point, label, or geometric primitive.
- "gltf" may be a URL or a complete data URI. Use a URL supplied by the intent when present.
  Otherwise, select the closest trusted Cesium sample asset below. Do not invent a URL and do not
  emit a truncated or placeholder data URI, because neither can load:
  - humanoid, person: `https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumMan/Cesium_Man.glb`
  - aircraft, airplane: `https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb`
  - vehicle, car, crane: `https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb`
  - rocket, launch vehicle: `https://cesium.com/public/SandcastleSampleData/launchvehicle.glb`
- "minimumPixelSize": keeps the model visible (at this minimum screen size) even when the camera is
  far away; "maximumScale" caps how large that minimum-size behavior can scale the model.
- "nodeTransformations": `{ "<nodeName>": { "translation": { "cartesian": [x, y, z] },
"rotation": { "unitQuaternion": [x, y, z, w] }, "scale": { "cartesian": [x, y, z] } } }` — applies a
  translation/rotation/scale to one named node inside the model (e.g. a joint or moving part), keyed
  by the node's name in the glTF asset.
- "articulations": `{ "<stage name> <articulation name>": <number> }` — sets a named glTF
  Articulation stage to a numeric value (the key is the stage name, a single space, then the
  articulation name, e.g. `"turret spin"`). For a value that animates over time, use the same
  "epoch" + interleaved-timestamp-and-value pattern as any other sampled property:
  `{ "epoch": "<ISO8601>", "turret spin": [t0, v0, t1, v1, ...] }`.

## Example: an aircraft with minimumPixelSize, and a vehicle with a time-varying articulation

```json
[
  { "id": "document", "name": "Models", "version": "1.0" },
  {
    "id": "aircraft-1",
    "position": { "cartographicDegrees": [-77, 37, 10000] },
    "model": {
      "gltf": "https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb",
      "minimumPixelSize": 64,
      "maximumScale": 20000
    }
  },
  {
    "id": "vehicle-1",
    "position": { "cartographicDegrees": [-75, 40, 0] },
    "model": {
      "gltf": "https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb",
      "articulations": {
        "epoch": "2026-01-01T00:00:00Z",
        "turret spin": [0, 0, 60, 60]
      }
    }
  }
]
```

## Example: a per-node transformation (a scaled and translated "boom" node)

```json
[
  { "id": "document", "name": "Node transformation", "version": "1.0" },
  {
    "id": "crane-1",
    "position": { "cartographicDegrees": [-75, 40, 0] },
    "model": {
      "gltf": "https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb",
      "nodeTransformations": {
        "boom": {
          "scale": { "cartesian": [1, 2, 3] },
          "translation": { "cartesian": [4, 5, 6] }
        }
      }
    }
  }
]
```
