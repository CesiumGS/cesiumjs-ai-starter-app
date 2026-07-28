import { describe, expect, it } from "vitest";
import { isExecuteCesiumCodeTool } from "./execute-cesium-code-result";

describe("isExecuteCesiumCodeTool", () => {
  it("returns true for the exact tool name", () => {
    expect(isExecuteCesiumCodeTool("executeCesiumCode")).toBe(true);
  });

  it("returns false for any other tool name", () => {
    expect(isExecuteCesiumCodeTool("flyTo")).toBe(false);
    expect(isExecuteCesiumCodeTool("")).toBe(false);
    expect(isExecuteCesiumCodeTool("executecesiumcode")).toBe(false);
  });
});
