import type { Viewer } from "cesium";

/**
 * How long to keep watching `viewer.scene.renderError` after a sandboxed snippet returns
 * successfully before declaring the call error-free. Bounded rather than indefinite: a runtime
 * render crash (bad style expression, invalid shader, ...) from newly-added content typically
 * surfaces within the first few render frames, but the listener can't be kept alive forever
 * without risking misattributing a later, unrelated crash to this call.
 */
export const DEFAULT_RENDER_ERROR_WATCH_MS = 1500;

export interface RenderErrorWatch {
  result: Promise<string | undefined>;
  finishExecution: () => void;
}

export function createRenderErrorWatch(viewer: Viewer, timeoutMs: number): RenderErrorWatch {
  const renderError = viewer.scene?.renderError;
  if (!renderError || typeof renderError.addEventListener !== "function") {
    return { result: Promise.resolve(undefined), finishExecution: () => {} };
  }

  let finishCalled = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveResult: (error: string | undefined) => void;
  const result = new Promise<string | undefined>((resolve) => {
    resolveResult = resolve;
  });

  const removeListener = renderError.addEventListener((_scene: unknown, error: unknown) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    removeListener();
    viewer.useDefaultRenderLoop = true;
    resolveResult(error instanceof Error ? error.message : String(error));
  });

  return {
    result,
    finishExecution: () => {
      if (finishCalled || settled) return;
      finishCalled = true;
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        removeListener();
        resolveResult(undefined);
      }, timeoutMs);
    },
  };
}

/**
 * Watches `viewer.scene.renderError` for a bounded window and resolves with the error message if
 * one fires, or `undefined` if the window elapses cleanly.
 *
 * This exists because a runtime crash from generated code doesn't necessarily happen inside the
 * sandboxed call itself: code that passes GATE 1 (static AST verification) and runs successfully
 * can still make Cesium throw *later*, on the next `requestAnimationFrame` render tick, once it
 * actually tries to render whatever was just added (e.g. `Model.applyStyle` evaluating a style
 * expression against real feature metadata, or a shader failing to compile) — a plain try/catch
 * around the sandboxed call can never observe this, since by the time it throws, that call has
 * already returned. `Scene.renderError` is the one Cesium API that does surface it.
 *
 * Cesium's own default behavior on any render error is to permanently stop the render loop
 * (`viewer.useDefaultRenderLoop` flips to `false`, freezing the view) and — unless
 * `showRenderLoopErrors: false` was passed to the `Viewer` (see `cesium-loader.ts`) — show a
 * blocking HTML panel. This resumes the render loop itself once the error is captured, so a bad
 * AI-generated snippet degrades to a reported error instead of a frozen view.
 */
export function waitForRenderError(
  viewer: Viewer,
  timeoutMs = DEFAULT_RENDER_ERROR_WATCH_MS,
): Promise<string | undefined> {
  const watch = createRenderErrorWatch(viewer, timeoutMs);
  watch.finishExecution();
  return watch.result;
}
