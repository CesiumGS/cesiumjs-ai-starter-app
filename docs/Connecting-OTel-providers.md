# Connecting to OTel Providers

This app exports **logs from both sides, plus backend traces, metrics**, via standard OTLP/HTTP. Backend and frontend are enabled and configured independently:

- **Backend** — server-side env vars (`TELEMETRY_ENABLED`, `OTEL_*`), read via
  [`backend/src/utils/env.ts`](../backend/src/utils/env.ts) and wired up in
  [`backend/src/utils/telemetry.ts`](../backend/src/utils/telemetry.ts).
  - **Logs**: every `AppLogger` call (agent-loop, tool, MCP logs) is emitted as an OTel log
    record (`/v1/logs`) via
    [`@opentelemetry/exporter-logs-otlp-http`](https://www.npmjs.com/package/@opentelemetry/exporter-logs-otlp-http),
    alongside the existing console output.
  - **Traces**: a `NodeTracerProvider` is registered globally, and
    [`@ai-sdk/otel`](https://www.npmjs.com/package/@ai-sdk/otel)'s `OpenTelemetry` integration is
    registered against it via `registerTelemetry()` — this makes every `streamText` call in
    `@cesium-ai/server`'s agent loop (`runAgent`) emit GenAI-semantic-convention spans
    (`invoke_agent` → `chat` → `execute_tool`, one per model round-trip and tool call) to
    `/v1/traces`, with no per-call opt-in needed.  - **Metrics**: a `MeterProvider` is registered globally with a `PeriodicExportingMetricReader`
    (default 60s export interval), exporting to `/v1/metrics`. `@cesium-ai/server`'s agent loop and
    `@cesium-ai/codegen-cesium`'s generation pipeline each get a `Meter`-backed metrics object
    (`createServerMetrics` / `createCodegenMetrics`) recording histograms: `cesium_ai.chat.tokens`
    and `cesium_ai.chat.request.duration` for the agent loop, `cesium_ai.codegen.tokens`,
    `cesium_ai.codegen.skill_match.score`, and `cesium_ai.codegen.generation.duration` for codegen.- **Frontend** — build-time Vite env vars (`VITE_TELEMETRY_ENABLED`, `VITE_OTEL_*`), read via
  [`frontend/src/utils/config.ts`](../frontend/src/utils/config.ts) and baked into the client
  bundle at build time (see `frontend/Dockerfile` build args / `compose.yaml`). Emits **logs only**
  (no tracer is registered client-side) from the chat panel and the codegen sandbox logger adapter.

Because both exporters speak plain OTLP/HTTP, any OTLP-compatible backend works — point the
endpoint (and, if required, auth headers) at your provider.

## Common configuration shape

| Concern                | Backend var                          | Frontend var                              |
| ----------------------- | ------------------------------------- | ------------------------------------------ |
| Enable export           | `TELEMETRY_ENABLED`                   | `VITE_TELEMETRY_ENABLED`                   |
| Base OTLP endpoint      | `OTEL_EXPORTER_OTLP_ENDPOINT`         | `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`         |
| Explicit logs endpoint  | `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`    | `VITE_OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`    |
| Explicit traces endpoint | `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | — (frontend emits no traces)               |
| Explicit metrics endpoint | `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | — (frontend emits no metrics)            |
| Auth/routing headers    | `OTEL_EXPORTER_OTLP_HEADERS`          | `VITE_OTEL_EXPORTER_OTLP_HEADERS`          |
| `service.name`          | `OTEL_SERVICE_NAME`                   | `VITE_OTEL_SERVICE_NAME`                   |
| `service.namespace`     | `OTEL_SERVICE_NAMESPACE`              | `VITE_OTEL_SERVICE_NAMESPACE`              |
| Extra resource attrs    | `OTEL_RESOURCE_ATTRIBUTES`            | `VITE_OTEL_RESOURCE_ATTRIBUTES`            |
| Log severity threshold  | `OTEL_LOG_LEVEL` (default `info`)     | `VITE_OTEL_LOG_LEVEL` (falls back to `VITE_LOG_LEVEL`) |

Headers use the same comma-separated `key=value,key2=value2` format for both sides and are shared
by logs, traces, and metrics on the backend (`OTLPLogExporter`, `OTLPTraceExporter`, and
`OTLPMetricExporter` all read `OTEL_EXPORTER_OTLP_HEADERS`). If
`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`/`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`/`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
(or the frontend's logs-only counterpart) is unset, the app appends `/v1/logs`, `/v1/traces`, or
`/v1/metrics` to the base endpoint automatically — set an explicit endpoint only when a provider's
ingestion path differs from that convention.

Frontend vars are **build-time**: changing them requires `npm run dev` restart / a Docker rebuild
(`docker compose up --build`), since Vite bakes them into the client bundle.

The sections below give per-provider `.env` snippets. Set backend vars in the repo-root `.env`
(consumed by `npm run dev:backend` / the `backend` container) and frontend vars in the same file
(consumed by `npm run dev:frontend` / the `frontend` build args in `compose.yaml`). Every backend
snippet below applies to both logs and traces automatically — there's no separate trace-only
config to add per provider.

## Aspire Dashboard (recommended for local testing)

The [Aspire Dashboard](https://aspire.dev/dashboard/standalone/) is the easiest way to see this
app's telemetry locally: one container, a built-in OTLP endpoint, and a UI with a trace viewer (for
the `invoke_agent`/`chat`/`execute_tool` span tree), a structured log viewer, and a Metrics tab (for
the `cesium_ai.chat.*`/`cesium_ai.codegen.*` histograms) — no cloud account, and no separate tool
needed for logs vs. traces vs. metrics the way a plain collector + `debug` exporter would require.

Unlike the backend (a server-to-server Node request, not subject to CORS), the frontend sends its
OTLP logs directly from the browser via `fetch`. The dashboard rejects cross-origin OTLP requests
by default, so without `DASHBOARD__OTLP__CORS__ALLOWEDORIGINS` set to the frontend's dev origin,
those requests silently fail (visible as a blocked/failed POST to `/v1/logs` in DevTools' Network
tab) and **only backend telemetry shows up** even though both sides are configured identically.
`DASHBOARD__OTLP__CORS__ALLOWEDHEADERS` is also required — its default only allows
`X-Requested-With`, but the browser OTLP exporter's preflight requests `content-type`, so without
this the preflight response omits `content-type` from `Access-Control-Allow-Headers` and the
browser still blocks the actual POST (same silent-failure symptom, easy to mistake for the origin
setting alone being wrong — check the preflight `OPTIONS` response's `Access-Control-Allow-Headers`
value in DevTools, not just `-Allow-Origin`):

```bash
docker run --rm -d -p 18888:18888 -p 4318:18890 --name aspire-dashboard \
  -e DASHBOARD__OTLP__CORS__ALLOWEDORIGINS=http://localhost:5173 \
  -e DASHBOARD__OTLP__CORS__ALLOWEDHEADERS="*" \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Use the following command to get the login token:

```
$loginLine =  docker container logs aspire-dashboard | Select-String "login\?t="
$matches = [regex]::Match($loginLine, "(?<=login\?t=)(\S+)")
$matches.Value | Set-Clipboard
echo $matches.Value
```

`.env`:

```bash
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

VITE_TELEMETRY_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Open `http://localhost:18888`, send a chat message that triggers a tool call, then check **Traces**
for the `invoke_agent` span tree, **Structured logs** for the corresponding `AppLogger` output, and
**Metrics** for the `cesium_ai.chat.tokens`/`cesium_ai.chat.request.duration` histograms (metrics
export on the default 60s interval, so allow a minute for the first data point to appear).

## OTel Collector (local, any backend)

Run a local [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) to receive OTLP
and fan it out to whatever backend you already use (Loki/Elasticsearch for logs, Tempo/Jaeger for
traces, a cloud vendor, etc.), instead of pointing this app directly at each provider. Prefer this
over the Aspire Dashboard when you specifically need to test the shape of data reaching a
particular downstream exporter (e.g. a vendor-specific processor/exporter config) rather than just
eyeballing spans and logs.

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
exporters:
  debug:
    verbosity: detailed
  # add your real backend's exporter(s) here (loki, otlphttp/<vendor>, etc.)
service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [debug]
    traces:
      receivers: [otlp]
      exporters: [debug]
    metrics:
      receivers: [otlp]
      exporters: [debug]
```

```bash
docker run --rm -p 4318:4318 -v ${PWD}/otel-collector-config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector:latest
```

`.env`:

```bash
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

VITE_TELEMETRY_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Verifying export

1. Set `TELEMETRY_ENABLED=true` / `VITE_TELEMETRY_ENABLED=true` plus the endpoint (and headers, if
   required) for your chosen provider in the repo-root `.env`.
2. Restart the backend (`tsx watch` only reloads on `.ts` changes, not `.env`) and rebuild the
   frontend if you changed `VITE_*` vars (`npm run dev:frontend` or `docker compose up --build`).
3. Send a chat message that triggers at least one tool call (e.g. ask it to fly somewhere, or run
   `executeCesiumCode`), then check your backend's ingestion UI, or the collector's `debug`
   exporter stdout, for:
   - Log records with `service.name` matching `OTEL_SERVICE_NAME` / `VITE_OTEL_SERVICE_NAME`.
   - A trace with a root `invoke_agent {modelId}` span, nested `chat {modelId}` spans (one per
     model round-trip) and `execute_tool {toolName}` spans (one per tool call) — backend only.
   - Metric data points for `cesium_ai.chat.tokens` and `cesium_ai.chat.request.duration` (and, for
     `executeCesiumCode` calls, `cesium_ai.codegen.*`) — backend only; these export on a 60s
     interval, so allow a minute after the request before checking.
4. See the [`README.md`](../README.md#environment-variables) environment variable table and
   [`.env.example`](../.env.example) for the full, authoritative list of telemetry vars.
