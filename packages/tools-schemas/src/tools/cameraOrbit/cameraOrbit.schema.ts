import { z } from "zod";

/** Supported actions for the additive `cameraOrbit` tool. */
export const cameraOrbitActionValues = ["start", "stop"] as const;

/** Literal-union shape of every supported `cameraOrbit` action. */
export const cameraOrbitActionShape = z.enum(cameraOrbitActionValues);

/**
 * Structural input shape for the `cameraOrbit` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraOrbit.ts` and `flyTo.schema.ts` for the convention this follows).
 *
 * Merges what used to be two separate tools (`cameraStartOrbit`/`cameraStopOrbit`)
 * into one discriminated `action` field — they always operate on the same
 * per-`Viewer` orbit state (see `@cesium-ai/tools`'s executor), so a single
 * start/stop pair is a natural discriminated union rather than two tool names.
 */
export const cameraOrbitInputShape = z.discriminatedUnion("action", [
  z.object({
    action: z.literal(cameraOrbitActionShape.enum.start),
    speed: z.number().min(0.1).max(10).optional(),
    direction: z.enum(["clockwise", "counterclockwise"]).optional(),
  }),
  z.object({ action: z.literal(cameraOrbitActionShape.enum.stop) }),
]);

/** Validated `cameraOrbit` input, inferred from {@link cameraOrbitInputShape}. */
export type CameraOrbitInput = z.infer<typeof cameraOrbitInputShape>;
