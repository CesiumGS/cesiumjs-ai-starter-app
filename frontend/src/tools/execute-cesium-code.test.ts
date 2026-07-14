import { describe, expect, it } from "vitest";
import type { Viewer } from "cesium";
import {
  executeApprovedCesiumCode,
  handleExecuteCesiumCodeResult,
  isExecuteCesiumCodeTool,
} from "./execute-cesium-code";

/**
 * Unit tests for the client-side half of the `executeCesiumCode` tool. There
 * is no client-side sandbox (see repo notes): `executeApprovedCesiumCode` runs
 * the server-verified snippet directly via `new Function("viewer", "Cesium",
 * code)`, so these tests exercise that execution path directly, plus the
 * `handleExecuteCesiumCodeResult` validation gate in front of it.
 */

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

describe("executeApprovedCesiumCode", () => {
  it("runs the snippet against the given viewer and returns null on success", async () => {
    const calls: unknown[] = [];
    const fakeViewer = {
      entities: {
        add: (entity: unknown) => calls.push(entity),
      },
    } as unknown as Viewer;

    const result = await executeApprovedCesiumCode(
      fakeViewer,
      `viewer.entities.add({ name: "test" });`,
    );

    expect(result).toBeNull();
    expect(calls).toEqual([{ name: "test" }]);
  });

  it("exposes the Cesium namespace as the second function parameter", async () => {
    const fakeViewer = {} as Viewer;

    // Cartesian3 is a real export of the `cesium` package — proves the
    // executed code can reach the real Cesium namespace, not a stub.
    const result = await executeApprovedCesiumCode(
      fakeViewer,
      `if (typeof Cesium.Cartesian3.fromDegrees !== "function") { throw new Error("no Cesium"); }`,
    );

    expect(result).toBeNull();
  });

  it("returns an error message when the code throws", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `throw new Error("boom");`);

    expect(result).toBe("Code execution failed: boom");
  });

  it("returns an error message for a non-Error throw", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `throw "just a string";`);

    expect(result).toBe("Code execution failed: just a string");
  });

  it("returns an error message when the code references undefined viewer state", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `viewer.camera.flyTo({});`);

    expect(result).toMatch(/Code execution failed:/);
  });

  it("catches a syntax error thrown by the Function constructor itself", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `this is not valid javascript(`);

    expect(result).toMatch(/Code execution failed:/);
  });

  describe("top-level `await` (regression: ast-verifier's GATE 1 permits it via allowAwaitOutsideFunction)", () => {
    // `packages/codegen-cesium/src/pipeline/ast-verifier.ts` deliberately
    // allows top-level `await` in generated code, on the assumption that
    // execution happens inside an async context. A bare `new Function("viewer",
    // "Cesium", code)` body is an ordinary function, NOT an async function or
    // module — top-level `await` in it is a `SyntaxError` at call time
    // ("await is only valid in async functions and the top level bodies of
    // modules"), reproduced live against a real model generating a
    // `Cesium3DTileset.fromUrl(...)` snippet. `executeApprovedCesiumCode` must
    // wrap execution in an async IIFE so GATE 1's assumption actually holds.
    it("awaits a resolved promise and applies its value, rather than throwing a SyntaxError", async () => {
      const calls: unknown[] = [];
      const fakeViewer = {
        entities: { add: (entity: unknown) => calls.push(entity) },
      } as unknown as Viewer;

      const result = await executeApprovedCesiumCode(
        fakeViewer,
        `const value = await Promise.resolve({ name: "async-ok" });\nviewer.entities.add(value);`,
      );

      expect(result).toBeNull();
      expect(calls).toEqual([{ name: "async-ok" }]);
    });

    it("surfaces a rejected top-level await as a graceful error, not an unhandled rejection", async () => {
      const fakeViewer = {} as Viewer;

      const result = await executeApprovedCesiumCode(
        fakeViewer,
        `await Promise.reject(new Error("async boom"));`,
      );

      expect(result).toBe("Code execution failed: async boom");
    });
  });
});

describe("handleExecuteCesiumCodeResult", () => {
  it("runs the code and returns null when the server result carries verified code", async () => {
    const calls: unknown[] = [];
    const fakeViewer = {
      entities: { add: (e: unknown) => calls.push(e) },
    } as unknown as Viewer;

    const result = await handleExecuteCesiumCodeResult(fakeViewer, {
      code: `viewer.entities.add({ name: "ok" });`,
    });

    expect(result).toBeNull();
    expect(calls).toEqual([{ name: "ok" }]);
  });

  it("returns null without executing anything when the server reports a verification error", async () => {
    const fakeViewer = {
      entities: { add: () => expect.fail("should not execute") },
    } as unknown as Viewer;

    const result = await handleExecuteCesiumCodeResult(fakeViewer, {
      error: "Generated code failed static AST verification.",
    });

    expect(result).toBeNull();
  });

  it('returns "Malformed executeCesiumCode result." for output matching neither shape', async () => {
    const fakeViewer = {} as Viewer;

    expect(await handleExecuteCesiumCodeResult(fakeViewer, {})).toBe(
      "Malformed executeCesiumCode result.",
    );
    expect(await handleExecuteCesiumCodeResult(fakeViewer, { code: 123 })).toBe(
      "Malformed executeCesiumCode result.",
    );
    expect(await handleExecuteCesiumCodeResult(fakeViewer, null)).toBe(
      "Malformed executeCesiumCode result.",
    );
    expect(await handleExecuteCesiumCodeResult(fakeViewer, "not an object")).toBe(
      "Malformed executeCesiumCode result.",
    );
  });

  it("returns a Viewer-not-initialised error when viewer is null, without throwing", async () => {
    const result = await handleExecuteCesiumCodeResult(null, { code: `viewer.entities.add({});` });

    expect(result).toBe("CesiumJS Viewer is not initialised");
  });

  it("propagates a runtime execution error from the executed code", async () => {
    const fakeViewer = {} as Viewer;

    const result = await handleExecuteCesiumCodeResult(fakeViewer, {
      code: `throw new Error("runtime failure");`,
    });

    expect(result).toBe("Code execution failed: runtime failure");
  });
});
