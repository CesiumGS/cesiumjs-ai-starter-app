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
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      onViewerDestroy();
    };
  }, []);

  return <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />;
}
