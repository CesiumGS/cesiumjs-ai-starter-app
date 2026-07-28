import { describe, expect, it, vi } from "vitest";
import type { Viewer } from "cesium";
import { waitForRenderError } from "./render-error-watch";

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

describe("waitForRenderError", () => {
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
