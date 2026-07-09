import { describe, expect, test } from "vitest";
import {
  getAllowedSymbols,
  intersectWithCapabilities,
  isSymbolAllowed,
  loadAllowedSymbols,
} from "./symbol-allowlist.js";

describe("loadAllowedSymbols", () => {
  test("parses a non-trivial number of entries from DOMAINS.md", () => {
    const entries = loadAllowedSymbols();
    expect(entries.length).toBeGreaterThan(100);
  });

  test("resolves a known symbol to its expected domain", () => {
    const entries = loadAllowedSymbols();
    const viewer = entries.find((entry) => entry.symbol === "Viewer");
    expect(viewer).toBeDefined();
    expect(viewer?.domain).toBe("cesiumjs-viewer-setup");
  });
});

describe("getAllowedSymbols", () => {
  test("domain-filtered results are a strict subset of the full list", () => {
    const all = getAllowedSymbols();
    const cameraOnly = getAllowedSymbols("cesiumjs-camera");

    expect(cameraOnly.length).toBeGreaterThan(0);
    expect(cameraOnly.length).toBeLessThan(all.length);
    for (const symbol of cameraOnly) {
      expect(all).toContain(symbol);
    }
  });
});

describe("isSymbolAllowed", () => {
  test("known symbol is allowed", () => {
    expect(isSymbolAllowed("Viewer")).toBe(true);
    expect(isSymbolAllowed("Viewer", "cesiumjs-viewer-setup")).toBe(true);
  });

  test("known symbol scoped to the wrong domain is not allowed", () => {
    expect(isSymbolAllowed("Viewer", "cesiumjs-camera")).toBe(false);
  });

  test("unknown symbol is not allowed", () => {
    expect(isSymbolAllowed("TotallyMadeUpSymbolThatDoesNotExist")).toBe(false);
  });
});

describe("intersectWithCapabilities", () => {
  test("returns only symbols present in both lists, deduped, order-stable relative to the first arg", () => {
    const result = intersectWithCapabilities(
      ["Viewer", "Camera", "Camera", "Entity", "NotExposed"],
      ["Entity", "Camera", "SomethingElse"],
    );
    expect(result).toEqual(["Camera", "Entity"]);
  });

  test("returns an empty array when there is no overlap", () => {
    expect(intersectWithCapabilities(["A", "B"], ["C", "D"])).toEqual([]);
  });
});
