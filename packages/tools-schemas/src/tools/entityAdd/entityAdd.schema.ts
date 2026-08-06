import { z } from "zod";
import { entityAddBillboardInputShape } from "./utils/entityAddBillboard.schema.js";
import { entityAddBoxInputShape } from "./utils/entityAddBox.schema.js";
import { entityAddCorridorInputShape } from "./utils/entityAddCorridor.schema.js";
import { entityAddCylinderInputShape } from "./utils/entityAddCylinder.schema.js";
import { entityAddEllipseInputShape } from "./utils/entityAddEllipse.schema.js";
import { entityAddLabelInputShape } from "./utils/entityAddLabel.schema.js";
import { entityAddModelInputShape } from "./utils/entityAddModel.schema.js";
import { entityAddPointInputShape } from "./utils/entityAddPoint.schema.js";
import { entityAddPolygonInputShape } from "./utils/entityAddPolygon.schema.js";
import { entityAddPolylineInputShape } from "./utils/entityAddPolyline.schema.js";
import { entityAddRectangleInputShape } from "./utils/entityAddRectangle.schema.js";
import { entityAddWallInputShape } from "./utils/entityAddWall.schema.js";

/** Supported entity variants accepted by the generic `entityAdd` tool. */
export const entityAddTypeValues = [
  "point",
  "billboard",
  "label",
  "model",
  "polygon",
  "polyline",
  "box",
  "corridor",
  "cylinder",
  "ellipse",
  "rectangle",
  "wall",
] as const;

/** Literal-union shape of every supported `entityAdd` variant. */
export const entityAddTypeShape = z.enum(entityAddTypeValues);

/**
 * Structural input shape for the additive `entityAdd` tool: one tool name with
 * a discriminated `type` field and a `data` payload that reuses the existing
 * per-entity input shapes. Each literal is read off {@link entityAddTypeShape}'s
 * own `.enum` accessors (not re-typed as a fresh string) so removing/renaming a
 * value in {@link entityAddTypeValues} breaks this list at compile time instead
 * of silently drifting.
 */
export const entityAddInputShape = z.discriminatedUnion("type", [
  z.object({ type: z.literal(entityAddTypeShape.enum.point), data: entityAddPointInputShape }),
  z.object({
    type: z.literal(entityAddTypeShape.enum.billboard),
    data: entityAddBillboardInputShape,
  }),
  z.object({ type: z.literal(entityAddTypeShape.enum.label), data: entityAddLabelInputShape }),
  z.object({ type: z.literal(entityAddTypeShape.enum.model), data: entityAddModelInputShape }),
  z.object({ type: z.literal(entityAddTypeShape.enum.polygon), data: entityAddPolygonInputShape }),
  z.object({
    type: z.literal(entityAddTypeShape.enum.polyline),
    data: entityAddPolylineInputShape,
  }),
  z.object({ type: z.literal(entityAddTypeShape.enum.box), data: entityAddBoxInputShape }),
  z.object({
    type: z.literal(entityAddTypeShape.enum.corridor),
    data: entityAddCorridorInputShape,
  }),
  z.object({
    type: z.literal(entityAddTypeShape.enum.cylinder),
    data: entityAddCylinderInputShape,
  }),
  z.object({ type: z.literal(entityAddTypeShape.enum.ellipse), data: entityAddEllipseInputShape }),
  z.object({
    type: z.literal(entityAddTypeShape.enum.rectangle),
    data: entityAddRectangleInputShape,
  }),
  z.object({ type: z.literal(entityAddTypeShape.enum.wall), data: entityAddWallInputShape }),
]);

/** Validated `entityAdd` input, inferred from {@link entityAddInputShape}. */
export type EntityAddInput = z.infer<typeof entityAddInputShape>;
