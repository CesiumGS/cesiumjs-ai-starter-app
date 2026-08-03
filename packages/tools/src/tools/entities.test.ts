import { describe, expect, test } from "vitest";
import { z } from "zod";
import { EntityCollection } from "cesium";
import type { Viewer } from "cesium";
import { entityAddPointInputShape } from "@cesium-ai/tools-schemas/schemas";
import {
  createEntityAddPointExecutor,
  entityAddPoint,
  entityAddPolygon,
  entityList,
  entityRemove,
} from "./entities.js";

function fakeViewer(): Viewer {
  return { entities: new EntityCollection() } as unknown as Viewer;
}

describe("entity executors", () => {
  test("entityAddPoint adds a point entity that entityList/entityRemove can see", async () => {
    const viewer = fakeViewer();

    const addResult = await entityAddPoint(viewer, {
      id: "point-1",
      position: { longitude: 2.35, latitude: 48.85 },
      color: "#ff0000",
    });
    expect(addResult).toEqual({ success: true, id: "point-1" });

    const listResult = await entityList(viewer, {});
    expect(listResult).toEqual({ success: true, entities: [{ id: "point-1", name: undefined }] });

    const removeResult = await entityRemove(viewer, { id: "point-1" });
    expect(removeResult).toEqual({ success: true, id: "point-1" });

    const removeAgain = await entityRemove(viewer, { id: "point-1" });
    expect(removeAgain.success).toBe(false);
  });

  test("entityAddPoint resolves { success: false, error } for malformed args, without adding anything", async () => {
    const viewer = fakeViewer();

    const result = await entityAddPoint(viewer, { id: "x" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid entityAddPoint arguments");
    expect(viewer.entities.values).toHaveLength(0);
  });

  test("entityAddPolygon requires at least 3 positions", async () => {
    const viewer = fakeViewer();

    const result = await entityAddPolygon(viewer, {
      id: "poly-1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("createEntityAddPointExecutor", () => {
  const extendedShape = z.object({
    ...entityAddPointInputShape.shape,
    tag: z.string().optional(),
  });

  test("merges extendEntityOptions' extra top-level fields into the added entity", async () => {
    const viewer = fakeViewer();
    const executor = createEntityAddPointExecutor<z.infer<typeof extendedShape>>({
      shape: extendedShape,
      extendEntityOptions: (data) => ({ properties: { tag: data.tag } }),
    });

    await executor(viewer, {
      id: "point-1",
      position: { longitude: 0, latitude: 0 },
      tag: "landmark",
    });

    const entity = viewer.entities.getById("point-1");
    expect(entity?.properties?.tag?.getValue()).toBe("landmark");
  });

  test("with no config, behaves identically to the default entityAddPoint export", async () => {
    const viewer = fakeViewer();
    const executor = createEntityAddPointExecutor();

    const result = await executor(viewer, {
      id: "point-1",
      position: { longitude: 0, latitude: 0 },
    });

    expect(result).toEqual({ success: true, id: "point-1" });
  });
});
