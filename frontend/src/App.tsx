import { useRef } from "react";
import type { Viewer } from "cesium";
import { Root } from "@stratakit/mui";
import CesiumGlobe from "./components/CesiumGlobe";
import ChatPanel from "./components/ChatPanel";

export default function App() {
  const viewerRef = useRef<Viewer | null>(null);

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
        }}
        onViewerDestroy={() => {
          viewerRef.current = null;
        }}
      />

      {/* AI chat panel — manages its own width (380 px open, 0 px collapsed) */}
      <ChatPanel viewerRef={viewerRef} />
    </Root>
  );
}
