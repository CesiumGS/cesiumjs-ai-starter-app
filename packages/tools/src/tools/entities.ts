import {
  Cartesian3,
  Color,
  CornerType,
  HeadingPitchRoll,
  Math as CesiumMath,
  Rectangle,
  Transforms,
} from "cesium";
import {
  entityAddBillboardInputShape,
  entityAddBoxInputShape,
  entityAddCorridorInputShape,
  entityAddCylinderInputShape,
  entityAddEllipseInputShape,
  entityAddLabelInputShape,
  entityAddModelInputShape,
  entityAddPointInputShape,
  entityAddPolygonInputShape,
  entityAddPolylineInputShape,
  entityAddRectangleInputShape,
  entityAddWallInputShape,
  entityListInputShape,
  entityRemoveInputShape,
  type EntityAddBillboardInput,
  type EntityAddBoxInput,
  type EntityAddCorridorInput,
  type EntityAddCylinderInput,
  type EntityAddEllipseInput,
  type EntityAddLabelInput,
  type EntityAddModelInput,
  type EntityAddPointInput,
  type EntityAddPolygonInput,
  type EntityAddPolylineInput,
  type EntityAddRectangleInput,
  type EntityAddWallInput,
} from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { ok, fail } from "../utils/result.js";
import { parseColor, positionToCartesian3, toCartesian2 } from "../utils/cesium-values.js";
import {
  createEntityAddExecutor,
  type EntityAddExecutorConfig,
} from "../utils/create-entity-add-executor.js";
import type { ToolExecutor } from "../types.js";

/** Builds an orientation quaternion from an optional heading/pitch/roll, or `undefined` if omitted. */
function toOrientation(
  positionCartesian: Cartesian3,
  orientation?: { heading?: number; pitch?: number; roll?: number },
) {
  if (!orientation) return undefined;
  return Transforms.headingPitchRollQuaternion(
    positionCartesian,
    HeadingPitchRoll.fromDegrees(
      orientation.heading ?? 0,
      orientation.pitch ?? 0,
      orientation.roll ?? 0,
    ),
  );
}

/** Builds an `entityAddPoint` executor — see `createEntityAddExecutor`'s doc comment for what `config` extends. */
export function createEntityAddPointExecutor<
  Args extends EntityAddPointInput = EntityAddPointInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddPointInput, Args>(
    "entityAddPoint",
    entityAddPointInputShape,
    (data) => ({
      id: data.id,
      description: data.description,
      position: positionToCartesian3(data.position),
      point: { color: parseColor(data.color, Color.WHITE), pixelSize: data.pixelSize ?? 10 },
    }),
    config,
  );
}

/** Default `entityAddPoint` executor. */
export const entityAddPoint: ToolExecutor = createEntityAddPointExecutor();

/** Builds an `entityAddBillboard` executor. */
export function createEntityAddBillboardExecutor<
  Args extends EntityAddBillboardInput = EntityAddBillboardInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddBillboardInput, Args>(
    "entityAddBillboard",
    entityAddBillboardInputShape,
    (data) => ({
      id: data.id,
      description: data.description,
      position: positionToCartesian3(data.position),
      billboard: {
        image: data.image,
        pixelOffset: toCartesian2(data.pixelOffset),
        width: data.width,
        height: data.height,
      },
    }),
    config,
  );
}

/** Default `entityAddBillboard` executor. */
export const entityAddBillboard: ToolExecutor = createEntityAddBillboardExecutor();

/** Builds an `entityAddLabel` executor. */
export function createEntityAddLabelExecutor<
  Args extends EntityAddLabelInput = EntityAddLabelInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddLabelInput, Args>(
    "entityAddLabel",
    entityAddLabelInputShape,
    (data) => ({
      id: data.id,
      description: data.description,
      position: positionToCartesian3(data.position),
      label: {
        text: data.text,
        font: data.font,
        fillColor: parseColor(data.fillColor, Color.WHITE),
        outlineColor: parseColor(data.outlineColor, Color.BLACK),
        outlineWidth: data.outlineWidth,
        pixelOffset: toCartesian2(data.pixelOffset),
      },
    }),
    config,
  );
}

/** Default `entityAddLabel` executor. */
export const entityAddLabel: ToolExecutor = createEntityAddLabelExecutor();

/** Builds an `entityAddModel` executor. */
export function createEntityAddModelExecutor<
  Args extends EntityAddModelInput = EntityAddModelInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddModelInput, Args>(
    "entityAddModel",
    entityAddModelInputShape,
    (data) => {
      const positionCartesian = positionToCartesian3(data.position);
      return {
        id: data.id,
        description: data.description,
        position: positionCartesian,
        orientation: toOrientation(positionCartesian, {
          heading: data.heading,
          pitch: data.pitch,
          roll: data.roll,
        }),
        model: { uri: data.uri, scale: data.scale, minimumPixelSize: data.minimumPixelSize },
      };
    },
    config,
  );
}

/** Default `entityAddModel` executor. */
export const entityAddModel: ToolExecutor = createEntityAddModelExecutor();

/** Builds an `entityAddPolygon` executor. */
export function createEntityAddPolygonExecutor<
  Args extends EntityAddPolygonInput = EntityAddPolygonInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddPolygonInput, Args>(
    "entityAddPolygon",
    entityAddPolygonInputShape,
    (data) => ({
      id: data.id,
      description: data.description,
      polygon: {
        hierarchy: data.positions.map(positionToCartesian3),
        material: parseColor(data.material, Color.WHITE.withAlpha(0.5)),
        outline: data.outlineColor !== undefined,
        outlineColor: parseColor(data.outlineColor, Color.BLACK),
        outlineWidth: data.outlineWidth,
        height: data.height,
        extrudedHeight: data.extrudedHeight,
      },
    }),
    config,
  );
}

/** Default `entityAddPolygon` executor. */
export const entityAddPolygon: ToolExecutor = createEntityAddPolygonExecutor();

/** Builds an `entityAddPolyline` executor. */
export function createEntityAddPolylineExecutor<
  Args extends EntityAddPolylineInput = EntityAddPolylineInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddPolylineInput, Args>(
    "entityAddPolyline",
    entityAddPolylineInputShape,
    (data) => ({
      id: data.id,
      description: data.description,
      polyline: {
        positions: data.positions.map(positionToCartesian3),
        width: data.width ?? 2,
        material: parseColor(data.material, Color.WHITE),
        clampToGround: data.clampToGround,
      },
    }),
    config,
  );
}

/** Default `entityAddPolyline` executor. */
export const entityAddPolyline: ToolExecutor = createEntityAddPolylineExecutor();

/** Builds an `entityAddBox` executor. */
export function createEntityAddBoxExecutor<Args extends EntityAddBoxInput = EntityAddBoxInput>(
  config: EntityAddExecutorConfig<Args> = {},
): ToolExecutor {
  return createEntityAddExecutor<EntityAddBoxInput, Args>(
    "entityAddBox",
    entityAddBoxInputShape,
    (data) => {
      const positionCartesian = positionToCartesian3(data.position);
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        position: positionCartesian,
        orientation: toOrientation(positionCartesian, data.orientation),
        box: {
          dimensions: new Cartesian3(
            data.box.dimensions.x,
            data.box.dimensions.y,
            data.box.dimensions.z,
          ),
          material: parseColor(data.box.material, Color.WHITE),
          outline: data.box.outline,
          outlineColor: parseColor(data.box.outlineColor, Color.BLACK),
        },
      };
    },
    config,
  );
}

/** Default `entityAddBox` executor. */
export const entityAddBox: ToolExecutor = createEntityAddBoxExecutor();

/** Builds an `entityAddCorridor` executor. */
export function createEntityAddCorridorExecutor<
  Args extends EntityAddCorridorInput = EntityAddCorridorInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddCorridorInput, Args>(
    "entityAddCorridor",
    entityAddCorridorInputShape,
    (data) => ({
      id: data.id,
      name: data.name,
      description: data.description,
      corridor: {
        positions: data.corridor.positions.map(positionToCartesian3),
        width: data.corridor.width,
        cornerType: data.corridor.cornerType ? CornerType[data.corridor.cornerType] : undefined,
        height: data.corridor.height,
        extrudedHeight: data.corridor.extrudedHeight,
        material: parseColor(data.corridor.material, Color.WHITE),
        outline: data.corridor.outline,
        outlineColor: parseColor(data.corridor.outlineColor, Color.BLACK),
      },
    }),
    config,
  );
}

/** Default `entityAddCorridor` executor. */
export const entityAddCorridor: ToolExecutor = createEntityAddCorridorExecutor();

/** Builds an `entityAddCylinder` executor. */
export function createEntityAddCylinderExecutor<
  Args extends EntityAddCylinderInput = EntityAddCylinderInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddCylinderInput, Args>(
    "entityAddCylinder",
    entityAddCylinderInputShape,
    (data) => {
      const positionCartesian = positionToCartesian3(data.position);
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        position: positionCartesian,
        orientation: toOrientation(positionCartesian, data.orientation),
        cylinder: {
          length: data.cylinder.length,
          topRadius: data.cylinder.topRadius,
          bottomRadius: data.cylinder.bottomRadius,
          material: parseColor(data.cylinder.material, Color.WHITE),
          outline: data.cylinder.outline,
          outlineColor: parseColor(data.cylinder.outlineColor, Color.BLACK),
        },
      };
    },
    config,
  );
}

/** Default `entityAddCylinder` executor. */
export const entityAddCylinder: ToolExecutor = createEntityAddCylinderExecutor();

/** Builds an `entityAddEllipse` executor. */
export function createEntityAddEllipseExecutor<
  Args extends EntityAddEllipseInput = EntityAddEllipseInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddEllipseInput, Args>(
    "entityAddEllipse",
    entityAddEllipseInputShape,
    (data) => ({
      id: data.id,
      name: data.name,
      description: data.description,
      position: positionToCartesian3(data.position),
      ellipse: {
        semiMajorAxis: data.ellipse.semiMajorAxis,
        semiMinorAxis: data.ellipse.semiMinorAxis,
        rotation:
          data.ellipse.rotation !== undefined
            ? CesiumMath.toRadians(data.ellipse.rotation)
            : undefined,
        height: data.ellipse.height,
        extrudedHeight: data.ellipse.extrudedHeight,
        material: parseColor(data.ellipse.material, Color.WHITE),
        outline: data.ellipse.outline,
        outlineColor: parseColor(data.ellipse.outlineColor, Color.BLACK),
      },
    }),
    config,
  );
}

/** Default `entityAddEllipse` executor. */
export const entityAddEllipse: ToolExecutor = createEntityAddEllipseExecutor();

/** Builds an `entityAddRectangle` executor. */
export function createEntityAddRectangleExecutor<
  Args extends EntityAddRectangleInput = EntityAddRectangleInput,
>(config: EntityAddExecutorConfig<Args> = {}): ToolExecutor {
  return createEntityAddExecutor<EntityAddRectangleInput, Args>(
    "entityAddRectangle",
    entityAddRectangleInputShape,
    (data) => {
      const { north, south, east, west } = data.rectangle.coordinates;
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        rectangle: {
          coordinates: Rectangle.fromDegrees(west, south, east, north),
          height: data.rectangle.height,
          extrudedHeight: data.rectangle.extrudedHeight,
          material: parseColor(data.rectangle.material, Color.WHITE),
          outline: data.rectangle.outline,
          outlineColor: parseColor(data.rectangle.outlineColor, Color.BLACK),
        },
      };
    },
    config,
  );
}

/** Default `entityAddRectangle` executor. */
export const entityAddRectangle: ToolExecutor = createEntityAddRectangleExecutor();

/** Builds an `entityAddWall` executor. */
export function createEntityAddWallExecutor<Args extends EntityAddWallInput = EntityAddWallInput>(
  config: EntityAddExecutorConfig<Args> = {},
): ToolExecutor {
  return createEntityAddExecutor<EntityAddWallInput, Args>(
    "entityAddWall",
    entityAddWallInputShape,
    (data) => ({
      id: data.id,
      name: data.name,
      description: data.description,
      wall: {
        positions: data.wall.positions.map(positionToCartesian3),
        minimumHeights: data.wall.minimumHeights,
        maximumHeights: data.wall.maximumHeights,
        material: parseColor(data.wall.material, Color.WHITE),
        outline: data.wall.outline,
        outlineColor: parseColor(data.wall.outlineColor, Color.BLACK),
      },
    }),
    config,
  );
}

/** Default `entityAddWall` executor. */
export const entityAddWall: ToolExecutor = createEntityAddWallExecutor();

/**
 * Default `entityList` executor. No factory — there's no per-tool args
 * contract to extend (no input fields at all); override this entry entirely
 * for custom listing behavior.
 */
export const entityList: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(entityListInputShape, rawArgs);
  if (!parsed.ok) return Promise.resolve(fail(`Invalid entityList arguments: ${parsed.error}`));
  const entities = viewer.entities.values.map((entity) => ({
    id: entity.id,
    name: entity.name ?? undefined,
  }));
  return Promise.resolve(ok({ entities }));
};

/**
 * Default `entityRemove` executor. No factory — a single `id` field has
 * nothing meaningful to extend; override this entry entirely for custom
 * removal behavior (e.g. removing by name instead of id).
 */
export const entityRemove: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(entityRemoveInputShape, rawArgs);
  if (!parsed.ok) return Promise.resolve(fail(`Invalid entityRemove arguments: ${parsed.error}`));
  const removed = viewer.entities.removeById(parsed.data.id);
  return Promise.resolve(
    removed ? ok({ id: parsed.data.id }) : fail(`No entity found with id "${parsed.data.id}".`),
  );
};
