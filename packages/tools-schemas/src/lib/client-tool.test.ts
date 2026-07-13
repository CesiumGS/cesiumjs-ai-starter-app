import { z } from "zod";
import { describe, expect, test, vi } from "vitest";
import { createToolFactory } from "./client-tool.js";

describe("createToolFactory", () => {
  const defaultDescription = "Default description.";
  const defaultSchema = z.object({ foo: z.string() });

  test("with no config, uses the default description and calls buildInputSchema(undefined)", () => {
    const buildInputSchema = vi.fn().mockReturnValue(defaultSchema);
    const createTool = createToolFactory(defaultDescription, buildInputSchema);

    const built = createTool();

    expect(built.description).toBe(defaultDescription);
    expect(buildInputSchema).toHaveBeenCalledWith(undefined);
  });

  test("config.description overrides the default", () => {
    const buildInputSchema = vi.fn().mockReturnValue(defaultSchema);
    const createTool = createToolFactory(defaultDescription, buildInputSchema);

    const built = createTool({ description: "Custom description." });

    expect(built.description).toBe("Custom description.");
  });

  test("config.fieldDescriptions is passed through to buildInputSchema", () => {
    const buildInputSchema = vi.fn().mockReturnValue(defaultSchema);
    const createTool = createToolFactory(defaultDescription, buildInputSchema);
    const fieldDescriptions = { foo: "custom hint" };

    createTool({ fieldDescriptions });

    expect(buildInputSchema).toHaveBeenCalledWith(fieldDescriptions);
  });

  test("config.inputSchema takes precedence over fieldDescriptions", () => {
    const buildInputSchema = vi.fn().mockReturnValue(defaultSchema);
    const createTool = createToolFactory(defaultDescription, buildInputSchema);
    const overrideSchema = z.object({ bar: z.number() });

    const built = createTool({
      fieldDescriptions: { foo: "ignored" },
      inputSchema: overrideSchema,
    });

    expect(built.inputSchema).toBe(overrideSchema);
    expect(buildInputSchema).not.toHaveBeenCalled();
  });
});
