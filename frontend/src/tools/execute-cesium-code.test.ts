import { describe, expect, it, vi } from "vitest";
import type { Viewer } from "cesium";
import { executeApprovedCesiumCode, handleExecuteCesiumCodeResult } from "./execute-cesium-code";

/**
 * Unit tests for the client-side half of the `executeCesiumCode` tool.
 * `executeApprovedCesiumCode` runs server-verified snippets through the
 * QuickJS-WASM sandbox, followed by the result validation gate.
 *
 * See also `execute-cesium-code-result.test.ts` (`isExecuteCesiumCodeTool`) and
 * `render-error-watch.test.ts` (standalone `waitForRenderError` behavior) — this file only covers
 * `waitForRenderError`'s *integration* with `executeApprovedCesiumCode` below.
 */

describe("executeApprovedCesiumCode", () => {
  it("runs the snippet against the given viewer and returns null on success", async () => {
    const calls: unknown[] = [];
    const fakeViewer = {
      entities: {
        values: [],
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

  it("exposes the sandbox's Cesium value-type bindings", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(
      fakeViewer,
      `if (typeof Cesium.Cartesian3.fromDegrees !== "function") { throw new Error("no Cesium"); }`,
    );

    expect(result).toBeNull();
  });

  it("returns an error message when the code throws", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `throw new Error("boom");`);

    expect(result).toContain("Code execution failed: Error: boom");
    expect(result).toContain("generated code line 1");
  });

  it("returns an error message for a non-Error throw", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `throw "just a string";`);

    expect(result).toContain("Code execution failed: Error: just a string");
  });

  it("returns an error message when the code references undefined viewer state", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `viewer.camera.flyTo({});`);

    expect(result).toMatch(/Code execution failed:/);
  });

  it("returns a syntax error from the sandbox", async () => {
    const fakeViewer = {} as Viewer;

    const result = await executeApprovedCesiumCode(fakeViewer, `this is not valid javascript(`);

    expect(result).toMatch(/Code execution failed:/);
  });

  describe("top-level `await`", () => {
    it("awaits a resolved promise and applies its value, rather than throwing a SyntaxError", async () => {
      const calls: unknown[] = [];
      const fakeViewer = {
        entities: { values: [], add: (entity: unknown) => calls.push(entity) },
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

      expect(result).toContain("Code execution failed: Error: async boom");
      expect(result).toContain("generated code line 1");
    });
  });

  describe("delayed render-loop crash reporting (waitForRenderError)", () => {
    /** A minimal fake mirroring Cesium's `Scene.renderError` `Event` API. */
    function fakeRenderErrorEvent() {
      const listeners = new Set<(scene: unknown, error: unknown) => void>();
      return {
        addEventListener: (listener: (scene: unknown, error: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        emit: (error: unknown) => {
          for (const listener of listeners) listener(undefined, error);
        },
        hasListeners: () => listeners.size > 0,
      };
    }

    /**
     * Polls until `waitForRenderError` has actually registered its listener. Needed because the
     * real QuickJS sandbox instantiation (`runCesiumCodeInSandbox`) takes more than one microtask
     * tick, so a single `await Promise.resolve()` can race ahead of listener registration and
     * silently drop a too-early `emit()`.
     */
    async function waitUntilListening(event: ReturnType<typeof fakeRenderErrorEvent>) {
      while (!event.hasListeners()) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    it("reports a renderError that fires after the sandboxed call already returned success", async () => {
      const renderError = fakeRenderErrorEvent();
      const fakeViewer = {
        entities: { values: [], add: () => {} },
        scene: { renderError },
        useDefaultRenderLoop: false, // Cesium already stopped the loop itself before we observe it
      } as unknown as Viewer;

      const resultPromise = executeApprovedCesiumCode(fakeViewer, `viewer.entities.add({});`);
      // Simulate Cesium's render loop throwing on the next animation frame, after the sandboxed
      // call has already resolved — this is exactly what a plain try/catch can't observe.
      await waitUntilListening(renderError);
      renderError.emit(new Error("shader compile failed"));

      expect(await resultPromise).toBe(
        "Code executed but caused a rendering error: shader compile failed",
      );
      // Resumes the render loop Cesium halted, instead of leaving the view permanently frozen.
      expect(fakeViewer.useDefaultRenderLoop).toBe(true);
    });

    it("reports a renderError caused by partial scene changes before generated code fails", async () => {
      const renderError = fakeRenderErrorEvent();
      const add = vi.fn();
      const fakeViewer = {
        entities: { values: [], add },
        scene: { renderError },
        useDefaultRenderLoop: false,
      } as unknown as Viewer;

      const resultPromise = executeApprovedCesiumCode(
        fakeViewer,
        `viewer.entities.add({}); throw new Error("later failure");`,
      );
      await waitUntilListening(renderError);
      while (add.mock.calls.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      renderError.emit(new Error("invalid partial scene state"));

      expect(await resultPromise).toContain(
        "partial scene changes also caused a rendering error: invalid partial scene state",
      );
      expect(fakeViewer.useDefaultRenderLoop).toBe(true);
    });
  });
});

describe("handleExecuteCesiumCodeResult", () => {
  it("runs the code and returns null when the server result carries verified code", async () => {
    const calls: unknown[] = [];
    const fakeViewer = {
      entities: { values: [], add: (e: unknown) => calls.push(e) },
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

  it("returns a structured error when the execution guard rejects a run", async () => {
    const fakeViewer = {
      entities: {
        values: [],
        add: () => expect.fail("should not execute"),
      },
    } as unknown as Viewer;

    const result = await handleExecuteCesiumCodeResult(
      fakeViewer,
      { code: `viewer.entities.add({});` },
      () => {
        throw new Error("rate limit reached");
      },
    );

    expect(result).toBe("Code execution failed: rate limit reached");
  });

  it("propagates a runtime execution error from the executed code", async () => {
    const fakeViewer = {} as Viewer;

    const result = await handleExecuteCesiumCodeResult(fakeViewer, {
      code: `throw new Error("runtime failure");`,
    });

    expect(result).toContain("Code execution failed: Error: runtime failure");
    expect(result).toContain("generated code line 1");
  });
});
