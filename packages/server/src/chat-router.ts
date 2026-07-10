import {
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
  type LanguageModel,
  type ToolApprovalConfiguration,
  type ToolSet,
  type UIMessage,
} from "ai";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { runAgent } from "./agent.js";

/** Default cap on the number of messages accepted in a single request. */
const DEFAULT_MAX_MESSAGES = 100;

export interface ChatRouterOptions {
  /**
   * The resolved language model the agent loop talks to. The host application
   * owns provider selection, SDK instantiation, and API keys — this package is
   * model-agnostic. Omit (or pass `undefined`) when no provider is configured;
   * `/api/chat` then returns a structured `NOT_CONFIGURED` payload.
   */
  model?: LanguageModel;
  /** Tool registry exposed to the agent loop (e.g. `createCesiumTools()`). */
  tools: ToolSet;
  /** System prompt override. Defaults to the package's CesiumJS preamble. */
  system?: string;
  /** Max agent steps per request. */
  maxSteps?: number;
  /** Max messages accepted per request. Defaults to 100. */
  maxMessages?: number;
  /** Per-tool human-in-the-loop approval gating — see {@link RunAgentOptions.toolApproval}. */
  toolApproval?: ToolApprovalConfiguration<ToolSet, never>;
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
      const result = await runAgent({
        messages: parsed.data.messages as unknown as UIMessage[],
        model,
        tools,
        system,
        maxSteps,
        toolApproval,
      });

      pipeUIMessageStreamToResponse({
        response: res,
        stream: toUIMessageStream({ stream: result.stream }),
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
