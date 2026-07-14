import { z } from "zod";

/**
 * Structural input shape for the `clockControl` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `clockControl.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const clockControlInputShape = z.object({
  action: z.enum(["configure", "setTime", "setMultiplier"]),
  clock: z
    .object({
      startTime: z.string().optional(),
      stopTime: z.string().optional(),
      currentTime: z.string().optional(),
      clockRange: z.enum(["UNBOUNDED", "CLAMPED", "LOOP_STOP"]).optional(),
      multiplier: z.number().optional(),
      shouldAnimate: z.boolean().optional(),
    })
    .optional(),
  currentTime: z.string().optional(),
  multiplier: z.number().optional(),
});

/** Validated `clockControl` input, inferred from {@link clockControlInputShape}. */
export type ClockControlInput = z.infer<typeof clockControlInputShape>;
