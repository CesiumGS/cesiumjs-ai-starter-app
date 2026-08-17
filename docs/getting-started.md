# Getting Started

<img src="https://raw.githubusercontent.com/CesiumGS/cesiumjs-ai-starter-app/main/docs/assets/ty-book.png" alt="Developer working with CesiumJS" align="right" width="200" class="doc-illustration" />

This guide gets you from a fresh clone to a running CesiumJS globe with an AI chat panel
that can fly the camera around on request.

## Prerequisites

Pick **one** of the two run modes below; each has its own prerequisites.

| Run mode                   | Requires                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **Docker (recommended)**   | [Docker Desktop](https://docs.docker.com/get-docker/) (includes Compose v2) — nothing else |
| **Local dev (hot reload)** | Node.js ≥ 20, npm ≥ 9                                                                      |

You'll also want, before you start:

- An **LLM API key** from one of: [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/settings/keys), or [Google Generative AI](https://aistudio.google.com/apikey). This powers
  the chat panel. Without one, the app still runs as a plain 3D globe viewer — the chat
  panel is simply omitted.
- (Optional) A free [Cesium Ion](https://ion.cesium.com) access token, for high-quality
  terrain and imagery. Without it the globe still works, using basic imagery.

## Step 1 — Get the code

This sample lives in its own standalone repo,
[`CesiumGS/cesiumjs-ai-starter-app`](https://github.com/CesiumGS/cesiumjs-ai-starter-app).
Grab it with [`degit`](https://github.com/Rich-Harris/degit) (no git history, just the
files; requires Node.js for `npx`):

```bash
npx degit CesiumGS/cesiumjs-ai-starter-app cesiumjs-ai-starter-app
cd cesiumjs-ai-starter-app
```

Every command below runs from this folder.

## Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in at least:

| Variable                                                                | Required?                               | Purpose                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `AI_PROVIDER`                                                           | To enable chat                          | `openai` \| `anthropic` \| `google` — which provider the agent loop uses |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | To enable chat (matching `AI_PROVIDER`) | The provider's API key. Only the one matching `AI_PROVIDER` is needed.   |
| `VITE_CESIUM_ION_ACCESS_TOKEN`                                          | Optional                                | Enables Cesium Ion terrain/imagery in the globe                          |

Leaving all provider keys blank is a supported mode: the globe still renders, but
`/api/chat` returns a structured `NOT_CONFIGURED` response and the chat panel is omitted.

See
[`.env.example`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/.env.example)
for the full list of variables (rate limiting, CORS allow-list, model override, telemetry,
etc.), each documented inline.

## Step 3 — Run it

### Option A — Docker (no Node.js needed) ⭐ recommended

Node.js, npm, and all dependencies live inside the containers — nothing is installed on
your machine.

```bash
docker compose up --build --wait
```

`--wait` returns only once both containers report **healthy**, so you know exactly when to
open the app:

**→ http://localhost:8080**

Stop it with `Ctrl+C` (or `docker compose down`). To rebuild after changing `.env`, re-run
the same command (the frontend bakes `VITE_*` values into the bundle at build time, so
changing them requires a rebuild).

### Option B — Local dev (hot reload)

```bash
npm install
npm run dev
```

- Globe (with HMR): **http://localhost:5173**
- Chat API: **http://localhost:3001**

`npm run dev` first builds the workspace packages (`tools-schemas`, `codegen-cesium`,
`sample-config`, `server`) once, then runs all six dev processes concurrently (four
packages in watch mode, plus the frontend and backend dev servers) — see the `dev` script in the root
[`package.json`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/package.json).

## Step 4 — Try it out

Open the app and type a place into the chat panel — e.g. **`fly to Paris`** — then send it.
The camera flies there and the assistant confirms on arrival. Any city, country, landmark,
or address the model knows works: try **London**, **Mount Everest**, or **1600
Pennsylvania Avenue**.

Without a provider API key, the chat panel is omitted entirely and the globe still works as
a plain viewer.

## Step 5 — Verify everything is healthy (Docker only)

```bash
curl -f http://localhost:8080/                   # frontend serves the SPA shell
curl -f http://localhost:8080/api/chat -X POST \
  -H "Content-Type: application/json" -d '{}'     # proxied to the backend (expect a 4xx, not a connection error)
docker compose ps                                 # both services should show "healthy"
```

## Next steps

- Read [`docs/architectures/architecture.md`](architectures/architecture.md) for how the pieces fit together, request
  flow, and deployment topology.
- Read [`docs/packages/index.md`](packages/index.md) for what each workspace package does and how they
  depend on each other.
- Read [`docs/tutorials/cesium-viewer-tools-tutorial.md`](tutorials/cesium-viewer-tools-tutorial.md) to learn
  how the CesiumJS viewer tools work, and how to add, configure, or remove one.

## Common issues

| Symptom                                                   | Likely cause / fix                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Chat panel doesn't appear                                 | No provider API key set for `AI_PROVIDER` in `.env` — this is expected, viewer-only mode              |
| Globe shows basic imagery only                            | `VITE_CESIUM_ION_ACCESS_TOKEN` not set — optional, get one free at https://ion.cesium.com             |
| `docker compose up` changes to `.env` don't seem to apply | `VITE_*` values are baked in at build time — re-run `docker compose up --build`                       |
| CORS error calling `/api/chat` in local dev               | `ALLOWED_ORIGIN` in `.env` doesn't match the Vite dev server origin (default `http://localhost:5173`) |
| `/api/chat` returns `400 NOT_CONFIGURED`                  | No provider key configured for the selected `AI_PROVIDER` — set it or switch `AI_PROVIDER`            |
