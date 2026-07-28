import {
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
  type LanguageModel,
  type ToolApprovalConfiguration,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { runAgent } from "./agent.js";

/** Default cap on the number of messages accepted in a single request. */
const DEFAULT_MAX_MESSAGES = 100;

/**
 * UI message chunk types that carry visible assistant prose. See
 * {@link suppressTextChunks}.
 */
const TEXT_CHUNK_TYPES: ReadonlySet<string> = new Set(["text-start", "text-delta", "text-end"]);

/**
 * True if any message in this request carries a just-approved, not-yet-
 * resolved approval response for a tool named in `toolNames` — i.e. this is
 * the request in which the AI SDK will execute that tool's `execute` for the
 * first time (after a prior request emitted its `tool-approval-request` and
 * paused). Scans the raw, not-yet-validated request body: a pending-approved
 * invocation's wire part looks like `{ type: "tool-<name>", state:
 * "approval-responded", approval: { approved: true, ... } }` (see
 * `packages/chat-element/src/chat-client/protocol.ts`'s `toRequestParts`).
 */
function hasPendingApprovedToolCall(
  messages: ReadonlyArray<Record<string, unknown>>,
  toolNames: readonly string[],
): boolean {
  for (const message of messages) {
    const parts = message.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as Record<string, unknown>;

      if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
      if (p.state !== "approval-responded") continue;
      if (!toolNames.includes(p.type.slice("tool-".length))) continue;

      const approval = p.approval as { approved?: unknown } | undefined;
      if (approval?.approved === true) return true;
    }
  }

  return false;
}

/**
 * Drops assistant text chunks from a UI message stream. Used when this
 * request resolves a `stopAfterTools`-gated tool's approval: the AI SDK still
 * has to invoke the model once for this request (there's no hook to skip that
 * first call), but at that point the model can only be reacting to a
 * preliminary/non-final tool result (e.g. `executeCesiumCode`'s server-side
 * verification, before the client has actually run anything) — so any text it
 * writes is real but premature, and would otherwise render as a confident
 * "I did X" the user hasn't actually seen confirmed. Dropping it here means
 * that text never reaches the client transcript at all (so it also never
 * becomes conversation history for a later request). The tool's own result
 * chunk (`tool-result`/`tool-output-available`) is untouched, so the frontend
 * still learns the tool ran and can act on it — the model gets its one real
 * chance to reply once a follow-up request reports the true, later-known
 * outcome (see `ChatClient`'s `onServerToolResult`/`continueConversation`).
 */
function suppressTextChunks(
  stream: ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (!TEXT_CHUNK_TYPES.has(chunk.type)) {
          controller.enqueue(chunk);
        }
      },
    }),
  );
}

export interface ChatRouterOptions {
  /**
   * The resolved language model the agent loop talks to. The host application
   * owns provider selection, SDK instantiation, and API keys — this package is
   * model-agnostic. Omit (or pass `undefined`) when no provider is configured;
   * `/api/chat` then returns a structured `NOT_CONFIGURED` payload.
   */
  model?: LanguageModel;
  /**
   * Tool registry exposed to the agent loop (e.g. `createCesiumTools()`).
   * Pass a function instead of a plain object to resolve the tool set fresh
   * per request — e.g. to merge in per-session tools (like a user-initiated
   * MCP connection) that aren't known at server-construction time. Called
   * once per `/api/chat` request, after request validation.
   */
  tools: ToolSet | ((req: Request) => ToolSet | Promise<ToolSet>);
  /** System prompt override. Defaults to the package's CesiumJS preamble. */
  system?: string;
  /** Max agent steps per request. */
  maxSteps?: number;
  /** Max messages accepted per request. Defaults to 100. */
  maxMessages?: number;
  /**
   * Per-tool human-in-the-loop approval gating — see
   * {@link RunAgentOptions.toolApproval}. Ignored when `resolveToolApproval`
   * is also provided.
   */
  toolApproval?: ToolApprovalConfiguration<ToolSet, never>;
  /**
   * Derives approval config from the request's resolved `tools` instead of a
   * fixed `toolApproval` — needed when `tools` is dynamic (e.g. gating any
   * tool name matching a naming convention, since per-session tool names
   * aren't known at server-construction time). Takes precedence over
   * `toolApproval` when both are set.
   */
  resolveToolApproval?: (tools: ToolSet) => ToolApprovalConfiguration<ToolSet, never>;
  /** Tool names to stop the loop after — see {@link RunAgentOptions.stopAfterTools}. */
  stopAfterTools?: readonly string[];
}

/**
 * Builds an Express `Router` that mounts `POST /api/chat` — the **key layer**.
 *
 * It reads no environment of its own: the resolved language model and tool
 * registry are injected by the host. The route validates the request envelope,
 * degrades gracefully when chat is disabled or no model is configured, runs the
 * `streamText` agent loop, and pipes the UI message stream back to the browser.
 *
 *   app.use(createChatRouter({ model, tools: createCesiumTools() }));
 */
export function createChatRouter(options: ChatRouterOptions): Router {
  const {
    model,
    tools,
    system,
    maxSteps,
    maxMessages = DEFAULT_MAX_MESSAGES,
    toolApproval,
    resolveToolApproval,
    stopAfterTools,
  } = options;

  const router = Router();

  // Minimal request shape: a non-empty list of message objects. The AI SDK's
  // `convertToModelMessages` performs the deeper structural validation; here we
  // just guard the envelope.
  const ChatRequestSchema = z.object({
    messages: z.array(z.record(z.string(), z.unknown())).min(1).max(maxMessages),
  });

  router.post("/api/chat", async (req: Request, res: Response) => {
    if (!model) {
      res.status(400).json({
        error: "NOT_CONFIGURED",
        message: "No language model configured. Set the provider API key to enable chat.",
      });
      return;
    }

    // Validate the request envelope first so malformed requests get a 400
    // regardless of provider configuration.
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "INVALID_REQUEST",
        message: `Request body must be { messages: Message[] } with 1..${maxMessages} messages.`,
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const resolvedTools = typeof tools === "function" ? await tools(req) : tools;
      const resolvedToolApproval = resolveToolApproval
        ? resolveToolApproval(resolvedTools)
        : toolApproval;

      const result = await runAgent({
        messages: parsed.data.messages as unknown as UIMessage[],
        model,
        tools: resolvedTools,
        system,
        maxSteps,
        toolApproval: resolvedToolApproval,
        stopAfterTools,
      });

      // If this request is resolving a `stopAfterTools` tool's approval, the
      // model's unavoidable first reply this turn can only be based on that
      // tool's preliminary result — strip its text so a premature confirmation
      // never reaches the client (see `suppressTextChunks`'s doc comment).
      const suppressReply =
        (stopAfterTools?.length ?? 0) > 0 &&
        hasPendingApprovedToolCall(parsed.data.messages, stopAfterTools!);

      const uiMessageStream = toUIMessageStream({ stream: result.stream });

      pipeUIMessageStreamToResponse({
        response: res,
        stream: suppressReply ? suppressTextChunks(uiMessageStream) : uiMessageStream,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (!res.headersSent) {
        res.status(500).json({ error: "AGENT_ERROR", message });
      } else {
        res.end();
      }
    }
  });

  return router;
}
