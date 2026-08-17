import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./index.css";
import App from "./App.tsx";
import { frontendLogger } from "./utils/telemetry";

frontendLogger.info("Frontend application bootstrapped");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
