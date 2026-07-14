# @cesium-ai/chat-element

AI chat panel React component backed by the Vercel AI SDK streaming protocol, styled with [StrataKit](https://stratakit.bentley.com/docs/) MUI components.

## Usage

```tsx
import { AiChatPanel } from "@cesium-ai/chat-element/react";

export default function App() {
  return <AiChatPanel />;
}
```

Connects to `/api/chat` by default and renders a resizable panel with a message list and input form. Wrap it in `<Root>` to provide a StrataKit theme.

## Props

| Prop          | Type                                   | Default       | Description                                   |
| ------------- | -------------------------------------- | ------------- | --------------------------------------------- |
| `apiEndpoint` | `string`                               | `"/api/chat"` | URL of the AI streaming endpoint              |
| `onToolCall`  | `(toolName, args) => Promise<unknown>` | —             | Called when the AI invokes a client-side tool |

## Handling tool calls

`onToolCall` routes a streamed tool call to your executor. The return value is posted back as the tool result:

```tsx
<AiChatPanel
  apiEndpoint="/api/chat"
  onToolCall={(toolName, args) => {
    return myToolExecutors[toolName]?.(args) ?? Promise.resolve({ success: false });
  }}
/>
```

See [`frontend/src/components/ChatPanel.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/ChatPanel.tsx) for the full wiring pattern, and the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for a step-by-step guide.
