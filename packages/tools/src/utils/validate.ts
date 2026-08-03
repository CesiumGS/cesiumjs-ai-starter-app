import type { z } from "zod";

/** The outcome of validating a tool call's raw args against its zod shape. */
export type ParsedArgs<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Validates untrusted, model-produced `rawArgs` against a tool's structural
 * shape (imported from `@cesium-ai/tools-schemas/schemas`) before any executor
 * touches the live `Viewer` with it. Every executor in this package calls this
 * first — never trust that a value the server accepted (or the model claims
 * to have sent) is safe to hand to a Cesium API unchecked.
 */
export function parseArgs<Schema extends z.ZodTypeAny>(
  shape: Schema,
  rawArgs: unknown,
): ParsedArgs<z.infer<Schema>> {
  const parsed = shape.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") };
  }
  return { ok: true, data: parsed.data as z.infer<Schema> };
}
