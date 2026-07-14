# @cesium-ai/server

[Express](https://expressjs.com) router that mounts the [AI SDK](https://sdk.vercel.ai/docs) chat endpoint (`POST /api/chat`). Runs the [`streamText`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text) agent loop server-side — the LLM API key never reaches the browser. Model-agnostic: the host app owns provider selection, SDK instantiation, and API keys.

## Usage

```ts
import express from "express";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { createModel } from "./providers.js";

const app = express();
app.use(express.json());
app.use(
  createChatRouter({
    model: createModel(),
    tools: createCesiumTools(),
  }),
);
```

When `model` is `undefined`, `/api/chat` responds `400 { error: "NOT_CONFIGURED" }` instead of throwing.

## Options

| Option        | Default                 | Description                                                                |
| ------------- | ----------------------- | -------------------------------------------------------------------------- |
| `model`       | —                       | Required to enable chat. Omit to run as a plain viewer.                    |
| `tools`       | —                       | Required. Tool registry, e.g. `createCesiumTools()`.                       |
| `system`      | `DEFAULT_SYSTEM_PROMPT` | System prompt override.                                                    |
| `maxSteps`    | `5`                     | Max agent-loop iterations per request.                                     |
| `maxMessages` | `100`                   | Max messages per request body; over the cap returns `400 INVALID_REQUEST`. |

### Overriding the system prompt

The package exports its default so you can extend rather than replace it:

```ts
import { DEFAULT_SYSTEM_PROMPT } from "@cesium-ai/server";

createChatRouter({
  model,
  tools: createCesiumTools(),
  system: `${DEFAULT_SYSTEM_PROMPT}\nAlways answer in French.`,
});
```

## Using `runAgent` directly

`runAgent` is the lower-level primitive `createChatRouter` calls per request. Use it to build a custom route:

```ts
import { runAgent, DEFAULT_MAX_STEPS, DEFAULT_SYSTEM_PROMPT } from "@cesium-ai/server";

const result = await runAgent({
  messages,
  model,
  tools,
  system: DEFAULT_SYSTEM_PROMPT,
  maxSteps: DEFAULT_MAX_STEPS,
});
```

## Exports

| Export                  | Description                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createChatRouter`      | Builds the [Express](https://expressjs.com) `Router` mounting `POST /api/chat`.                                                                  |
| `ChatRouterOptions`     | Type for `createChatRouter`'s options.                                                                                                           |
| `runAgent`              | Runs one agent-loop turn with [`streamText`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text).                                      |
| `DEFAULT_MAX_STEPS`     | Default `maxSteps` (`5`).                                                                                                                        |
| `DEFAULT_SYSTEM_PROMPT` | Default system prompt string — see [`src/agent.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/server/src/agent.ts). |
| `RunAgentOptions`       | Type for `runAgent`'s options.                                                                                                                   |
