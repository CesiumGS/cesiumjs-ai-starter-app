# @cesium-ai/chat-element

React chat panel component backed by the Vercel AI SDK streaming protocol, styled with
[StrataKit](https://stratakit.bentley.com/docs/) MUI components.

## Basic usage

```tsx
import { AiChatPanel } from "@cesium-ai/chat-element/react";

export default function App() {
  return <AiChatPanel />;
}
```

Connects to `/api/chat` by default and renders a resizable panel with a message list and
input form. Wrap it in a StrataKit `<Root>` to provide a theme.

## Props

| Prop          | Type                                   | Default       | Description                                   |
| ------------- | -------------------------------------- | ------------- | --------------------------------------------- |
| `apiEndpoint` | `string`                               | `"/api/chat"` | URL of the AI streaming endpoint              |
| `onToolCall`  | `(toolName, args) => Promise<unknown>` | —             | Called when the AI invokes a client-side tool |

## Handling tool calls

`onToolCall` is the hook the host uses to route a streamed tool call to its own executor.
The return value is posted back to the agent loop as the tool result.

```tsx
import { AiChatPanel } from "@cesium-ai/chat-element/react";

<AiChatPanel
  apiEndpoint="/api/chat"
  onToolCall={(toolName, args) => {
    // look up and run the right executor, return a result
    return myToolExecutors[toolName]?.(args) ?? Promise.resolve({ success: false });
  }}
/>;
```

See [`frontend/src/components/ChatPanel.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/ChatPanel.tsx)
for the full wiring pattern used in this starter, and the
[Cesium Viewer Tools Tutorial](../../tutorials/cesium-viewer-tools-tutorial.md) for a step-by-step guide to adding executors.
