import type { Entity, Viewer } from "cesium";
import type { z } from "zod";
import { parseArgs } from "./validate.js";
import { ok, fail } from "./result.js";
import type { ToolExecutor } from "../types.js";

/** Config accepted by an `entityAdd*` tool's `createXExecutor` factory. */
export interface EntityAddExecutorConfig<Args> {
  /**
   * Validated args shape. Defaults to the tool's own base shape — pass an
   * extended shape (one that still infers every base field) to accept extra
   * fields.
   */
  shape?: z.ZodType<Args>;
  /**
   * Derives extra top-level `Entity.ConstructorOptions` fields (e.g.
   * `properties`, `availability`, `viewFrom`) from the validated args, merged
   * in **after** the tool's own base options. This merge is shallow at the
   * `Entity` level — it can't reach into a nested graphics object (e.g. add a
   * field to the built `point`/`polygon`/... sub-object) without replacing it
   * entirely; do a full override (replace the executor) instead if you need
   * that.
   */
  extendEntityOptions?: (data: Args) => Partial<Entity.ConstructorOptions>;
}

/**
 * Builds an `entityAdd*` executor: validates `rawArgs` against `shape`,
 * builds the tool's base `Entity.ConstructorOptions` via `buildBaseOptions`
 * (each tool's own, tool-specific logic), merges in any extra options from
 * `config.extendEntityOptions`, and adds the result to `viewer.entities` —
 * the validate/build/add/error-handling plumbing shared by every
 * `entityAdd*` default executor in this package (mirrors `createFlyToExecutor`'s
 * role for `flyTo`). Every `entityAdd*` tool exports its own
 * `createXExecutor` built from this, so a host only ever supplies what's
 * actually tool-specific — the default shape and `buildBaseOptions` are
 * already wired in by that tool's own factory.
 */
export function createEntityAddExecutor<Base, Args extends Base = Base>(
  toolName: string,
  defaultShape: z.ZodType<Base>,
  buildBaseOptions: (data: Args) => Entity.ConstructorOptions,
  config: EntityAddExecutorConfig<Args> = {},
): ToolExecutor {
  const shape = config.shape ?? (defaultShape as unknown as z.ZodType<Args>);

  return (viewer: Viewer, rawArgs: unknown) => {
    const parsed = parseArgs(shape, rawArgs);
    if (!parsed.ok) return Promise.resolve(fail(`Invalid ${toolName} arguments: ${parsed.error}`));

    try {
      const entity = viewer.entities.add({
        ...buildBaseOptions(parsed.data),
        ...config.extendEntityOptions?.(parsed.data),
      });
      return Promise.resolve(ok({ id: entity.id }));
    } catch (err) {
      return Promise.resolve(fail(err instanceof Error ? err.message : String(err)));
    }
  };
}
