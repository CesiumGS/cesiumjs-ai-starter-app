import { describe, expect, it, vi } from "vitest";
import type { Viewer } from "cesium";
import {
  executeApprovedCesiumCode,
  handleExecuteCesiumCodeResult,
  isExecuteCesiumCodeTool,
  waitForRenderError,
} from "./execute-cesium-code";

/**
 * Unit tests for the client-side half of the `executeCesiumCode` tool.
 * `executeApprovedCesiumCode` runs server-verified snippets through the
 * QuickJS-WASM sandbox, followed by the result validation gate.
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

      expect(result).toBe("Code execution failed: async boom");
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

    it("handles a non-Error renderError value", async () => {
      const renderError = fakeRenderErrorEvent();
      const fakeViewer = {
        scene: { renderError },
        useDefaultRenderLoop: false,
      } as unknown as Viewer;

      const resultPromise = waitForRenderError(fakeViewer, 1000);
      renderError.emit("plain string error");

      expect(await resultPromise).toBe("plain string error");
    });

    it("resolves undefined (no false positive) once the watch window elapses with no error", async () => {
      vi.useFakeTimers();
      try {
        const renderError = fakeRenderErrorEvent();
        const fakeViewer = { scene: { renderError } } as unknown as Viewer;

        const resultPromise = waitForRenderError(fakeViewer, 1000);
        await vi.advanceTimersByTimeAsync(1000);

        expect(await resultPromise).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("resolves immediately without waiting when the viewer has no scene.renderError", async () => {
      const fakeViewer = {} as Viewer;

      expect(await waitForRenderError(fakeViewer)).toBeUndefined();
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

    expect(result).toBe("Code execution failed: runtime failure");
  });
});
