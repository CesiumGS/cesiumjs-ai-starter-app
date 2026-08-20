---
name: czml-3d-tiles
description: "CZML 3D Tiles tileset references for large-scale photogrammetry, city buildings, or point cloud datasets loaded from an external tileset.json. Use when the intent describes referencing, loading, or displaying a 3D Tiles tileset by URI."
---

# CZML 3D Tiles

- "tileset": `{ "uri": "<URL to tileset.json>", "show": true|false,
"maximumScreenSpaceError": <number> }` — references an existing 3D Tiles tileset by its
  `tileset.json` URI, rather than embedding tile data directly. The tileset packet has no
  "position" of its own — the tileset defines its own georeferenced location.
- Do not invent a real-looking external URL unless the intent explicitly supplies one; a
  placeholder path (e.g. `"./BatchedBuildings/tileset.json"`) is fine when the intent only names
  the tileset conceptually.

## Example: referencing an existing tileset

```json
[
  { "id": "document", "name": "3D Tiles reference", "version": "1.0" },
  {
    "id": "batched-buildings",
    "name": "BatchedBuildings",
    "tileset": {
      "uri": "./BatchedBuildings/tileset.json"
    }
  }
]
```
