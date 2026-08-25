# `@cesium-ai/observability`

Shared logging and metrics contracts and defaults for the Cesium AI packages.

The package provides the canonical logger and metrics types, no-op defaults, and a configurable
console logger. Host applications still own provider-specific implementations such as OpenTelemetry
exporters and lifecycle management.

```ts
import {
  createConsoleLogger,
  noopCodegenMetrics,
  type CodegenMetrics,
  type Logger,
} from "@cesium-ai/observability";

const logger: Logger = createConsoleLogger({ scope: "my-app", level: "info" });
const metrics: CodegenMetrics = noopCodegenMetrics;
```

Other workspace packages accept these contracts directly and do not re-export them.
