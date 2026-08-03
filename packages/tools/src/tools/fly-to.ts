import { Cartesian3, type Camera, type Viewer } from "cesium";
import type { z } from "zod";
import { flyToInputShape, type FlyToInput } from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { ok, fail } from "../utils/result.js";
import type { ToolExecutor } from "../types.js";

/** Camera height above the ellipsoid, in metres, used when the model omits one. */
const DEFAULT_ALTITUDE = 15000;

/**
 * The subset of `Camera.flyTo`'s options an extended executor can add on top
 * of the base ones (`destination` is always derived from
 * `latitude`/`longitude`/`altitude`; `complete`/`cancel` always resolve the
 * `ToolExecutionResult` — neither can be overridden here).
 */
export type FlyToCameraOptions = Omit<
  Parameters<Camera["flyTo"]>[0],
  "destination" | "complete" | "cancel"
>;

/** Config accepted by {@link createFlyToExecutor}. */
export interface FlyToExecutorConfig<Args extends FlyToInput = FlyToInput> {
  /**
   * Validated args shape. Defaults to the base {@link flyToInputShape}
   * (latitude/longitude/altitude only) — pass an extended shape (one that
   * still infers every base field, e.g. this repo's own `flyToShape` adding
   * `duration`/`easingFunction`) to accept extra fields.
   */
  shape?: z.ZodType<Args>;
  /**
   * Derives extra `Camera.flyTo` options (e.g. `duration`, `easingFunction`)
   * from the validated args. Called after the base executor has already
   * validated `rawArgs` against `shape` — anything returned here is merged
   * in alongside the base `destination`/`complete`/`cancel`.
   */
  buildFlyToOptions?: (data: Args) => FlyToCameraOptions;
}

/**
 * Builds a `flyTo` executor, reusing the base validation / Cartesian3
 * conversion / promise / error-handling plumbing and letting you extend only
 * what actually differs: the accepted args shape and any extra
 * `Camera.flyTo` options derived from it. Prefer this over hand-writing a
 * whole new executor when you only need extra fields on top of the stock
 * `flyTo` contract (e.g. this repo's own `duration`/`easingFunction`,
 * `frontend/src/tools/camera.ts`) — see the package README's "Extending
 * flyTo" section for the full worked example.
 */
export function createFlyToExecutor<Args extends FlyToInput = FlyToInput>(
  config: FlyToExecutorConfig<Args> = {},
): ToolExecutor {
  const shape = config.shape ?? (flyToInputShape as unknown as z.ZodType<Args>);
  const buildFlyToOptions = config.buildFlyToOptions;

  return (viewer: Viewer, rawArgs: unknown) => {
    const parsed = parseArgs(shape, rawArgs);
    if (!parsed.ok) return Promise.resolve(fail(`Invalid flyTo arguments: ${parsed.error}`));

    const { latitude, longitude, altitude } = parsed.data;
    const extraOptions = buildFlyToOptions?.(parsed.data) ?? {};

    return new Promise((resolve) => {
      try {
        viewer.camera.flyTo({
          ...extraOptions,
          destination: Cartesian3.fromDegrees(longitude, latitude, altitude ?? DEFAULT_ALTITUDE),
          complete: () => resolve(ok()),
          cancel: () => resolve(fail("Camera flight was cancelled before completing.")),
        });
      } catch (err) {
        resolve(fail(err instanceof Error ? err.message : String(err)));
      }
    });
  };
}

/**
 * Default `flyTo` executor — {@link createFlyToExecutor} with no extension.
 *
 * This is deliberately the **base** contract only (no `duration`/
 * `easingFunction`). An app that extends `flyToInputShape` (e.g. this repo's
 * own sample app) should call {@link createFlyToExecutor} itself with its own
 * extended `shape`/`buildFlyToOptions` rather than trying to configure this
 * one — see the package README's "Extending flyTo" section.
 */
export const flyTo: ToolExecutor = createFlyToExecutor();
