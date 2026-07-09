/**
 * Helpers for the AI SDK v5+ UI message stream wire protocol: shaping outgoing
 * request parts, decoding incoming SSE chunks, and turning failed responses
 * into readable errors.
 */

import type { Message, UIMessageChunk } from "./types";

/**
 * A "not configured" failure (no/invalid provider API key) is a setup state the
 * host surfaces with a dedicated banner. It also reads inline in the transcript
 * as an error message, using this friendly text in place of the raw server error.
 */
export const NOT_CONFIGURED_MESSAGE =
  "AI is not configured. Add a supported provider API key to your .env file.";

export interface ChatError {
  /** The server's structured error code (e.g. "NOT_CONFIGURED"), when known. */
  code?: string;
  message: string;
}

export function isNotConfiguredError(error: ChatError): boolean {
  return error.code === "NOT_CONFIGURED";
}

/**
 * Project a flat UI {@link Message} into the AI SDK `UIMessage` `parts` array
 * the server's `convertToModelMessages` consumes. Text becomes a `text` part;
 * each tool invocation becomes a `tool-<toolName>` part — `output-available`
 * (carrying its result) once the client has resolved it, otherwise
 * `input-available` (the call without a result yet).
 */
export function toRequestParts(message: Message): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];

  if (message.content) {
    parts.push({ type: "text", text: message.content });
  }

  for (const t of message.toolInvocations ?? []) {
    parts.push(
      t.state === "result"
        ? {
            type: `tool-${t.toolName}`,
            toolCallId: t.toolCallId,
            state: "output-available",
            input: t.args,
            output: t.result,
          }
        : {
            type: `tool-${t.toolName}`,
            toolCallId: t.toolCallId,
            state: "input-available",
            input: t.args,
          },
    );
  }

  return parts;
}

/**
 * Parse one line of the AI SDK v5+ UI message stream (Server-Sent Events).
 * SSE only carries payload on `data:` lines; blanks, comments, headers, and
 * the terminal `data: [DONE]` all resolve to `null`, as does a partial/non-JSON
 * keep-alive line.
 */
export function parseSSELine(line: string): UIMessageChunk | null {
  if (!line.startsWith("data:")) return null;

  const data = line.slice("data:".length).trim();
  if (!data || data === "[DONE]") return null;

  try {
    return JSON.parse(data) as UIMessageChunk;
  } catch {
    return null;
  }
}

/**
 * Turn a failed (or unexpected-HTML) response into a human-readable error
 * message. An HTML body means the request hit the wrong origin — typically
 * the frontend dev server returning its SPA shell because `/api/chat` is not
 * proxied to the backend. Otherwise we try the server's structured
 * `{ error, message }` JSON envelope, then fall back to the raw body.
 */
export async function describeError(response: Response, api: string): Promise<ChatError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    return {
      message:
        `The chat request to "${api}" returned an HTML page instead of a chat stream. ` +
        `The frontend is likely calling itself rather than the chat backend — ` +
        `check the API endpoint or dev-server proxy configuration.`,
    };
  }

  const body = await response.text().catch(() => "");
  if (!body) return { message: `The chat request failed (HTTP ${response.status}).` };

  try {
    const json = JSON.parse(body) as { error?: string; message?: string };
    if (typeof json.message === "string") {
      return {
        code: json.error,
        message: json.error ? `${json.error}: ${json.message}` : json.message,
      };
    }
  } catch {
    // Not JSON — fall through and surface the raw text.
  }

  return { message: body.length > 500 ? `${body.slice(0, 500)}…` : body };
}
