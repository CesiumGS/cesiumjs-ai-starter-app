import type { Tool } from "ai";
import type { McpToolsLogger } from "./logger.js";

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

/**
 * Wraps a tool's `execute` so a stalled MCP server can't hang the agent loop
 * past `timeoutMs`. Generic over `T` (rather than fixed to `Tool`) so any
 * extra properties the caller attached to the tool object - e.g. `McpTool`'s
 * `mcpApp` widget metadata - survive the wrap.
 */
export function withTimeout<T extends Tool>(
  tool: T,
  timeoutMs: number,
  describe: string,
  logger: McpToolsLogger,
): T {
  const originalExecute = tool.execute;
  if (!originalExecute) return tool;
  return {
    ...tool,
    execute: async (input, options) => {
      const result = originalExecute(input, options);
      // MCP tool calls resolve a single CallToolResult — never AsyncIterable —
      // but guard defensively and skip timeout-wrapping anything streamed.
      if (isAsyncIterable(result)) return result;

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          logger.warn(`Tool call timed out after ${timeoutMs}ms`, { tool: describe });
          reject(new Error(`MCP tool "${describe}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      try {
        return await Promise.race([result, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  } as T;
}
