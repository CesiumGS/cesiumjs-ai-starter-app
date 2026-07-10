# @cesium-ai/chat-element

AI chat panel React component backed by the Vercel AI SDK streaming protocol, styled with [StrataKit](https://stratakit.bentley.com/docs/) MUI components.

## Basic usage

```tsx
import { AiChatPanel } from "@cesium-ai/chat-element/react";

export default function App() {
  return <AiChatPanel />;
}
```

The component connects to `/api/chat` by default and renders a resizable panel with a message list and input form. It works out of the box with any StrataKit theme — wrap it in `<Root>` to provide one.

### Props

| Prop          | Type                                   | Default       | Description                                   |
| ------------- | -------------------------------------- | ------------- | --------------------------------------------- |
| `apiEndpoint` | `string`                               | `"/api/chat"` | URL of the AI streaming endpoint              |
| `onToolCall`  | `(toolName, args) => Promise<unknown>` | —             | Called when the AI invokes a client-side tool |
