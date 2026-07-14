import { z } from "zod";
import { mergeDescriptions } from "./merge-descriptions.js";

/**
 * Applies a `.describe()` hint to every field of a zod object shape. Generic
 * over the shape so it works for any tool's structural fields, not just one.
 */
export function describeShape<Shape extends z.ZodRawShape>(
  shape: Shape,
  descriptions: Record<keyof Shape, string>,
): z.ZodObject<Shape> {
  const described = Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      (field as z.ZodTypeAny).describe(descriptions[key as keyof Shape]),
    ]),
  ) as unknown as Shape;
  return z.object(described);
}

/**
 * Builds a tool's **model-facing** input schema in one step: merges per-field
 * `.describe()` overrides over the tool's defaults ({@link mergeDescriptions}),
 * then decorates the structural shape with the merged text
 * ({@link describeShape}). Every `buildXInputSchema` in this package is just
 * this call with its own shape and defaults plugged in.
 */
export function buildDescribedSchema<Shape extends z.ZodRawShape>(
  shape: Shape,
  defaults: Record<keyof Shape, string>,
  overrides: Partial<Record<keyof Shape, string>> = {},
): z.ZodObject<Shape> {
  return describeShape(shape, mergeDescriptions(defaults, overrides));
}
