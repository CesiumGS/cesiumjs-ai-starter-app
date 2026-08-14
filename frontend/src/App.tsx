import { useRef } from "react";
import type { Viewer } from "cesium";
import { Root } from "@stratakit/mui";
import CesiumGlobe from "./components/CesiumGlobe";
import ChatPanel from "./components/ChatPanel";
import { registerAppWebMcpTools } from "./tools/webmcp-tools";

export default function App() {
  const viewerRef = useRef<Viewer | null>(null);
  const webMcpUnregisterRef = useRef<(() => void) | null>(null);
  // Guards against React StrictMode's dev-only double-invoke of effects: the first mount's viewer
  // is destroyed before its (async) WebMCP registration finishes, so `onViewerDestroy` aborts this
  // controller immediately. `registerAppWebMcpTools` checks the signal before every individual
  // tool registration, so a superseded mount stops mid-batch instead of racing the second mount's
  // registration for the same tool names (previously both mounts could interleave registerTool
  // calls, so a tool name could non-deterministically end up bound to the already-destroyed
  // first-mount viewer).
  const cancelPendingWebMcpRegistrationRef = useRef<AbortController | null>(null);

  return (
    <Root
      colorScheme="dark"
      unstable_accentColor="cobalt"
      style={{ display: "flex", width: "100%", height: "100%" }}
    >
      {/* Globe fills remaining width */}
      <CesiumGlobe
        onViewerReady={(viewer) => {
          viewerRef.current = viewer;
          const cancelController = new AbortController();
          cancelPendingWebMcpRegistrationRef.current = cancelController;
          void registerAppWebMcpTools(viewer, cancelController.signal).then(({ unregister }) => {
            if (cancelController.signal.aborted) {
              unregister();
              return;
            }
            webMcpUnregisterRef.current = unregister;
          });
        }}
        onViewerDestroy={() => {
          viewerRef.current = null;
          cancelPendingWebMcpRegistrationRef.current?.abort();
          webMcpUnregisterRef.current?.();
          webMcpUnregisterRef.current = null;
        }}
      />

      {/* AI chat panel — manages its own width (380 px open, 0 px collapsed) */}
      <ChatPanel viewerRef={viewerRef} />
    </Root>
  );
}
