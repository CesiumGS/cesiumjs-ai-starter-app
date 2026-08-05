import { entityAddTypeValues } from "./entityAdd.schema.js";

/** Minimal valid `data` payload for each `entityAdd` variant, per its own `entityAdd*` input shape. */
export const MINIMAL_VALID_ENTITY_ADD_DATA: Record<(typeof entityAddTypeValues)[number], unknown> =
  {
    point: { id: "p1", position: { longitude: 0, latitude: 0 } },
    billboard: {
      id: "b1",
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/icon.png",
    },
    label: { id: "l1", position: { longitude: 0, latitude: 0 }, text: "Label" },
    model: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/model.glb",
    },
    polygon: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    polyline: {
      id: "pl1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    box: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 1, y: 1, z: 1 } },
    },
    corridor: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: 10,
      },
    },
    cylinder: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: 5, bottomRadius: 5 },
    },
    ellipse: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
    },
    rectangle: {
      rectangle: { coordinates: { north: 1, south: 0, east: 1, west: 0 } },
    },
    wall: {
      wall: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 10],
      },
    },
  };
