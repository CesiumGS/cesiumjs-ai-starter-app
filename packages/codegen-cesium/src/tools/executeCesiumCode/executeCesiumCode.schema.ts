import { z } from "zod";

/**
 * Structural input shape for the `executeCesiumCode` tool — the **single
 * source of truth for the args contract**, shared by the server tool
 * definition and the client-side result validator.
 *
 * This carries NO model-facing description text: the `.describe()` hints and
 * the human-readable tool `description` (which the LLM reads, and which can
 * reveal capabilities) are layered on server-side — see
 * `executeCesiumCode.ts`. This file imports only `zod`, never `ai` or the
 * tool registry, so the frontend can import it to validate the untrusted args
 * it receives without pulling tool *definitions* into the client bundle.
 */
export const executeCesiumCodeInputShape = z.object({
  /**
   * A natural-language description of what should happen on the globe — NOT
   * code. The model never authors CesiumJS code directly; the intent is
   * turned into verified code by `generateVerifiedCesiumCode` (see
   * `executeCesiumCode.ts` / `generate-verified-cesium-code.ts`).
   */
  intent: z.string().min(1),
});

/** Validated `executeCesiumCode` input, inferred from {@link executeCesiumCodeInputShape}. */
export type ExecuteCesiumCodeInput = z.infer<typeof executeCesiumCodeInputShape>;
