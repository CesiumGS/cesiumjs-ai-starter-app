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

| Prop                 | Type                                                                                            | Default       | Description                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiEndpoint`        | `string`                                                                                        | `"/api/chat"` | URL of the AI streaming endpoint                                                                                                                                                                                                            |
| `onToolCall`         | `(toolName, args) => Promise<unknown>`                                                          | —             | Called when the AI invokes a client-side tool                                                                                                                                                                                               |
| `onServerToolResult` | `(toolCall: { toolCallId, toolName, output }) => ToolExecutionOutcome \| void \| Promise<...>`  | —             | Called whenever a server-resolved tool result (`tool-output-available`) arrives. Return a `ToolExecutionOutcome` to replace the recorded result and/or trigger a follow-up request once the host discovers the real (e.g. runtime) outcome. |
| `onApprovalRequired` | `(toolCall: { toolCallId, toolName, args }) => Promise<{ approved: boolean; reason?: string }>` | —             | Overrides the panel's built-in Approve/Reject UI for a `needsApproval`-gated tool call. When omitted, `AiChatPanel` shows its own inline Approve/Reject buttons and resolves the decision itself.                                           |
| `maxToolCallRounds`  | `number`                                                                                        | —             | Hard cap on consecutive server round trips driven by client-resolved tool calls, guarding against a model that keeps emitting tool calls turn after turn.                                                                                   |

### Exports

| Export path                      | Description                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@cesium-ai/chat-element`        | `AiChatPanel` (React component, re-exported), `ChatClient`, and the `Message`/`ToolExecutionOutcome`/`ToolInvocation` types |
| `@cesium-ai/chat-element/react`  | `AiChatPanel` React component and its `AiChatPanelProps` type                                                               |
| `@cesium-ai/chat-element/client` | The framework-agnostic `ChatClient` (implements the AI SDK v5 UI message stream protocol) and its supporting types          |
