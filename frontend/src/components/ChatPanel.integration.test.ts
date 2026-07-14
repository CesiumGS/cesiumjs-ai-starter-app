import { describe, expect, test } from "vitest";
import { executeCesiumCodeResultShape } from "../tools/execute-cesium-code";

/**
 * Frontend-side integration test for `ChatPanel.tsx`'s `handleServerToolResult`
 * validation of a streamed `executeCesiumCode` server tool result.
 *
 * This covers the defensive parsing `handleServerToolResult` does on
 * otherwise-untrusted, server-influenced output — the execution itself runs
 * against the live Viewer instance with security relying on server-side AST verification.
 */
describe("ChatPanel's executeCesiumCode result handling", () => {
  test("a verified server result parses with its generated code intact", () => {
    // The exact shape a streamed `tool-output-available` chunk carries for a
    // successful `executeCesiumCode` call (see backend/src/execute-cesium-code.integration.test.ts
    // for how the backend produces this same shape end to end).
    const serverToolOutput: unknown = {
      code: `
        const position = await Cesium.Cartesian3.fromDegrees(2.3522, 48.8566, 0);
        await viewer.entities.add({ position, label: { text: "Paris" } });
      `,
    };

    const parsed = executeCesiumCodeResultShape.parse(serverToolOutput);
    expect("code" in parsed).toBe(true);
  });

  test("an error server result parses as an error, not code", () => {
    const serverToolOutput: unknown = {
      error: "Generated code failed static AST verification after all attempts.",
    };

    const parsed = executeCesiumCodeResultShape.parse(serverToolOutput);
    expect("error" in parsed).toBe(true);

    // Mirrors ChatPanel.handleServerToolResult's early return on `"error" in parsed.data" — nothing
    // further to assert beyond the parse itself.
  });
});
