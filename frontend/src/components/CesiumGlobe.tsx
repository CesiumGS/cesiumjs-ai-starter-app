import { useEffect, useRef } from "react";
import type { Viewer } from "cesium";
import { initViewer } from "../utils/cesium-loader";

interface CesiumGlobeProps {
  onViewerReady: (viewer: Viewer) => void;
  onViewerDestroy: () => void;
}

export default function CesiumGlobe({ onViewerReady, onViewerDestroy }: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    viewerRef.current = initViewer(containerRef.current);
    onViewerReady(viewerRef.current);

    // Dev-only test seam: expose the live Viewer on `window` so Playwright e2e specs can inspect
    // real Viewer state (entities/primitives/camera/etc.) after AI-generated code runs, instead of
    // only asserting "no error surfaced". `import.meta.env.DEV` is false in production builds
    // (`vite build`), so this never ships to a production bundle.
    if (import.meta.env.DEV) {
      (window as unknown as { __cesiumViewerForE2E?: Viewer }).__cesiumViewerForE2E =
        viewerRef.current;
    }

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      onViewerDestroy();
      if (import.meta.env.DEV) {
        delete (window as unknown as { __cesiumViewerForE2E?: Viewer }).__cesiumViewerForE2E;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />;
}
