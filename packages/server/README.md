# @cesium-ai/server

An Express router that mounts the AI SDK chat key-layer (`POST /api/chat`). It runs the `streamText` agent loop server-side against a host-supplied tool registry and language model, so the LLM API key never reaches the browser. This package is **model-agnostic** — it reads no environment of its own; the host app owns provider selection, SDK instantiation, and API keys.

## Usage

```ts
import express from "express";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { createModel } from "./providers.js"; // host-owned provider factory

const app = express();
app.use(express.json());
app.use(
  createChatRouter({
    model: createModel(/* ... */), // undefined if no provider is configured
    tools: createCesiumTools(),
  }),
);
```

When `model` is `undefined` (no provider key configured), `/api/chat` responds `400 { error: "NOT_CONFIGURED" }` instead of throwing, so a host can run as a plain viewer without a key.

## Configuring or overriding defaults

`createChatRouter` accepts a `ChatRouterOptions` object:

| Option           | Default                             | Description                                                                                              |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `model`          | —                                   | Required to enable chat. Omit to run with `/api/chat` returning `NOT_CONFIGURED`.                        |
| `tools`          | —                                   | Required. The tool registry exposed to the agent loop, e.g. `createCesiumTools()`.                       |
| `system`         | `DEFAULT_SYSTEM_PROMPT` (see below) | System prompt override.                                                                                  |
| `maxSteps`       | `DEFAULT_MAX_STEPS` = `5`           | Max agent-loop iterations (model call → tool call → model call) per request.                             |
| `maxMessages`    | `DEFAULT_MAX_MESSAGES` = `100`      | Max messages accepted in a single request body; requests over the cap get `400 INVALID_REQUEST`.         |
| `toolApproval`   | —                                   | Per-tool human-in-the-loop approval gating, passed straight through to `streamText`.                     |
| `stopAfterTools` | —                                   | Tool names to end the agent loop after, instead of letting the model reply in the same turn (see below). |

`system`, `maxSteps`, `toolApproval`, and `stopAfterTools` are forwarded to `runAgent` (see below); `maxMessages` is enforced only at the router's request-validation layer.

### Overriding the system prompt

```ts
createChatRouter({
  model,
  tools: createCesiumTools(),
  system: "You are a museum-tour guide embedded in a 3D globe. ...",
});
```

The package exports its default so a host can extend rather than replace it:

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

### Deferring the model's reply for tools with a delayed real outcome

Some tools only report an intermediate result server-side (e.g. "the generated code passed
verification") while their real, final outcome (e.g. "it actually ran without error in the
browser") is only known later and reported back via a separate follow-up request. Left alone, the
agent loop would let the model reply immediately after the intermediate result — often producing a
confident "I did X" before the action has actually been confirmed to succeed. Pass such tool names
via `stopAfterTools` to end the loop right after that tool's result instead, so the model only gets
a chance to reply once a follow-up request (starting a fresh agent loop) reports the real outcome:

```ts
createChatRouter({
  model,
  tools: { ...createCesiumTools(), executeCesiumCode },
  stopAfterTools: ["executeCesiumCode"],
});
```

## Using the agent loop directly

`runAgent` (also exported) is the lower-level primitive `createChatRouter` calls per request. Use it directly if you need to build a custom route instead of mounting the provided router:

```ts
import { runAgent, DEFAULT_MAX_STEPS, DEFAULT_SYSTEM_PROMPT } from "@cesium-ai/server";

const result = await runAgent({
  messages, // UIMessage[] from the client
  model,
  tools,
  system: DEFAULT_SYSTEM_PROMPT, // optional, this is the default
  maxSteps: DEFAULT_MAX_STEPS, // optional, this is the default
});
```

## Exports

| Export                  | From         | Description                                            |
| ----------------------- | ------------ | ------------------------------------------------------ |
| `createChatRouter`      | `./index.js` | Builds the Express `Router` mounting `POST /api/chat`. |
| `ChatRouterOptions`     | `./index.js` | Type for `createChatRouter`'s options.                 |
| `runAgent`              | `./index.js` | Runs one agent-loop turn with `streamText`.            |
| `DEFAULT_MAX_STEPS`     | `./index.js` | Default `maxSteps` (`5`).                              |
| `DEFAULT_SYSTEM_PROMPT` | `./index.js` | Default system prompt string.                          |
| `RunAgentOptions`       | `./index.js` | Type for `runAgent`'s options.                         |
