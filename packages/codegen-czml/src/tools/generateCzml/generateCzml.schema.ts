import { z } from "zod";

/**
 * Structural input shape for the `generateCzml` tool — the **single source of truth for the
 * args contract**, shared by the server tool definition and the client-side result validator.
 *
 * This carries NO model-facing description text: the `.describe()` hints and the human-readable
 * tool `description` (which the LLM reads, and which can reveal capabilities) are layered on
 * server-side — see `generateCzml.ts`. This file imports only `zod`, never `ai` or the tool
 * registry, so the frontend can import it without pulling tool *definitions* into the client
 * bundle.
 */
export const generateCzmlInputShape = z.object({
  /**
   * A natural-language description of the time-dynamic scene to create — NOT CZML. The model
   * never authors CZML directly; the intent is turned into a verified CZML document by
   * `generateVerifiedCzml` (see `generateCzml.ts` / `generate-verified-czml.ts`).
   */
  intent: z.string().min(1),
});

/** Validated `generateCzml` input, inferred from {@link generateCzmlInputShape}. */
export type GenerateCzmlInput = z.infer<typeof generateCzmlInputShape>;
