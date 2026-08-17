import { useRef } from "react";
import type { Viewer } from "cesium";
import { registerAppWebMcpTools } from "./webmcp-tools";

/**
 * Encapsulates this app's WebMCP registration lifecycle so `App.tsx` only needs to call
 * `onViewerReady`/`onViewerDestroy` from `CesiumGlobe`'s own callbacks — see
 * `registerAppWebMcpTools` (./webmcp-tools.ts) for what actually gets registered.
 */
export function useAppWebMcp() {
  const unregisterRef = useRef<(() => void) | null>(null);
  // Guards against React StrictMode's dev-only double-invoke of effects: the first mount's viewer
  // is destroyed before its (async) WebMCP registration finishes, so `onViewerDestroy` aborts this
  // controller immediately. `registerAppWebMcpTools` checks the signal before every individual
  // tool registration, so a superseded mount stops mid-batch instead of racing the second mount's
  // registration for the same tool names (previously both mounts could interleave registerTool
  // calls, so a tool name could non-deterministically end up bound to the already-destroyed
  // first-mount viewer).
  const cancelPendingRegistrationRef = useRef<AbortController | null>(null);

  function onViewerReady(viewer: Viewer) {
    const cancelController = new AbortController();
    cancelPendingRegistrationRef.current = cancelController;
    void registerAppWebMcpTools(viewer, cancelController.signal).then(({ unregister }) => {
      if (cancelController.signal.aborted) {
        unregister();
        return;
      }
      unregisterRef.current = unregister;
    });
  }

  function onViewerDestroy() {
    cancelPendingRegistrationRef.current?.abort();
    unregisterRef.current?.();
    unregisterRef.current = null;
  }

  return { onViewerReady, onViewerDestroy };
}
