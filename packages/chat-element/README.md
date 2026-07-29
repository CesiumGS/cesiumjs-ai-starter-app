# @cesium-ai/chat-element

AI chat panel [React](https://react.dev) component backed by the [Vercel AI SDK](https://sdk.vercel.ai/docs) streaming protocol, styled with [StrataKit](https://stratakit.bentley.com/docs/) [MUI](https://mui.com) components.

## Usage

```tsx
import { AiChatPanel } from "@cesium-ai/chat-element/react";

export default function App() {
  return <AiChatPanel />;
}
```

Connects to `/api/chat` by default and renders a resizable panel with a message list and input form. Wrap it in `<Root>` to provide a StrataKit theme.

## Props

| Prop                 | Type                                                                                            | Default       | Description                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiEndpoint`        | `string`                                                                                        | `"/api/chat"` | URL of the AI streaming endpoint                                                                                                                                                                                                                   |
| `onToolCall`         | `(toolName, args) => Promise<unknown>`                                                          | —             | Called when the AI invokes a client-side tool                                                                                                                                                                                                      |
| `onServerToolResult` | `(toolCall: { toolCallId, toolName, output }) => ToolExecutionOutcome \| void \| Promise<...>`  | —             | Called whenever a server-resolved tool result (`tool-output-available`) arrives. Return a `ToolExecutionOutcome` to replace the recorded result and/or trigger a follow-up request once the host discovers the real (e.g. runtime) outcome.        |
| `onApprovalRequired` | `(toolCall: { toolCallId, toolName, args }) => Promise<{ approved: boolean; reason?: string }>` | —             | Overrides the panel's built-in Approve/Reject UI for a `needsApproval`-gated tool call. When omitted, `AiChatPanel` shows its own inline Approve/Reject buttons and resolves the decision itself.                                                  |
| `maxToolCallRounds`  | `number`                                                                                        | —             | Hard cap on consecutive server round trips driven by client-resolved tool calls, guarding against a model that keeps emitting tool calls turn after turn.                                                                                          |
| `codeResultToolName` | `string`                                                                                        | —             | Name of a tool whose result gets a dedicated code/error rendering instead of the generic result view (e.g. this repo's `executeCesiumCode`, via `CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode`). Omitted means every tool call renders generically. |

### Exports

| Export path                      | Description                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@cesium-ai/chat-element`        | `AiChatPanel` (React component, re-exported), `ChatClient`, and the `Message`/`ToolExecutionOutcome`/`ToolInvocation` types |
| `@cesium-ai/chat-element/react`  | `AiChatPanel` React component and its `AiChatPanelProps` type                                                               |
| `@cesium-ai/chat-element/client` | The framework-agnostic `ChatClient` (implements the AI SDK v5 UI message stream protocol) and its supporting types          |

See [`frontend/src/components/ChatPanel.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/ChatPanel.tsx) for the full wiring pattern, and the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for a step-by-step guide.
