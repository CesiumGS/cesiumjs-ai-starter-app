# @cesium-ai/server

An Express router that mounts the AI SDK chat endpoint (`POST /api/chat`). It runs the
`streamText` agent loop server-side against a host-supplied tool registry and language
model, so the LLM API key never reaches the browser. **Model-agnostic** — it reads no
environment of its own; the host app owns provider selection, SDK instantiation, and API
keys.

## Basic usage

```ts
import express from "express";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { createModel } from "./providers.js"; // host-owned provider factory

const app = express();
app.use(express.json());
app.use(
  createChatRouter({
    model: createModel(), // undefined if no provider is configured
    tools: createCesiumTools(),
  }),
);
```

When `model` is `undefined`, `/api/chat` responds `400 { error: "NOT_CONFIGURED" }` instead
of throwing, so a host can run as a plain viewer without a provider key.

## Configuration

`createChatRouter` accepts a `ChatRouterOptions` object:

| Option        | Default                        | Description                                                                              |
| ------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `model`       | —                              | Required to enable chat. Omit to run with `/api/chat` returning `NOT_CONFIGURED`.        |
| `tools`       | —                              | The tool registry exposed to the agent loop, e.g. `createCesiumTools()`.                 |
| `system`      | `DEFAULT_SYSTEM_PROMPT`        | System prompt override.                                                                  |
| `maxSteps`    | `DEFAULT_MAX_STEPS` = `5`      | Max agent-loop iterations (model call → tool call → model call) per request.             |
| `maxMessages` | `DEFAULT_MAX_MESSAGES` = `100` | Max messages accepted per request body; requests over the cap get `400 INVALID_REQUEST`. |

### Overriding the system prompt

Extend the default rather than replace it so you keep the base globe-assistant context:

```ts
import { DEFAULT_SYSTEM_PROMPT } from "@cesium-ai/server";

createChatRouter({
  model,
  tools: createCesiumTools(),
  system: `${DEFAULT_SYSTEM_PROMPT}\nAlways answer in French.`,
});
```

### Overriding step and message limits

```ts
createChatRouter({
  model,
  tools: createCesiumTools(),
  maxSteps: 10, // allow longer tool-calling chains
  maxMessages: 50, // tighten the per-request history cap
});
```

## Using the agent loop directly

`runAgent` is the lower-level primitive `createChatRouter` calls per request. Use it
directly if you need a custom route instead of the provided router:

```ts
import { runAgent, DEFAULT_MAX_STEPS, DEFAULT_SYSTEM_PROMPT } from "@cesium-ai/server";

const result = await runAgent({
  messages, // UIMessage[] from the client
  model,
  tools,
  system: DEFAULT_SYSTEM_PROMPT,
  maxSteps: DEFAULT_MAX_STEPS,
});
```

## API reference

| Export                  | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `createChatRouter`      | Builds the Express `Router` mounting `POST /api/chat`. |
| `ChatRouterOptions`     | Options type for `createChatRouter`.                   |
| `runAgent`              | Runs one agent-loop turn with `streamText`.            |
| `RunAgentOptions`       | Options type for `runAgent`.                           |
| `DEFAULT_SYSTEM_PROMPT` | Default system prompt string.                          |
| `DEFAULT_MAX_STEPS`     | Default `maxSteps` value (`5`).                        |
| `DEFAULT_MAX_MESSAGES`  | Default `maxMessages` value (`100`).                   |
