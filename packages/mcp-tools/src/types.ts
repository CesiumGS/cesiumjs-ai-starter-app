import { z } from "zod";

/**
 * How to connect to one MCP server. Mirrors `@ai-sdk/mcp`'s network transport
 * shapes — stdio (spawning a local executable) is deliberately unsupported,
 * since a config-driven `command` to spawn is a much larger attack surface
 * than a URL this app merely calls, and this repo has no legitimate use case
 * needing a locally-spawned MCP server.
 */
export type McpTransportConfig = {
  type: "sse" | "http";
  /** MCP server URL. Must come from trusted, server-only config. */
  url: string;
  headers?: Record<string, string>;
};

const McpTransportConfigSchema = z.object({
  type: z.enum(["sse", "http"]),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
});

/** One MCP server this app trusts and should connect to. */
export interface McpServerConfig {
  /**
   * Short, unique identifier for this server. Used to namespace its tools
   * (`mcp__<name>__<toolName>`) so multiple servers can never collide, and in
   * logs/error messages to trace which server a tool call belongs to.
   */
  name: string;
  transport: McpTransportConfig;
  /**
   * Only expose these tool names from this server. Omit to expose every tool
   * the server advertises — prefer an explicit allowlist for any MCP server
   * you don't fully control, since an unlisted allowlist means a server
   * update can silently hand the model a brand-new tool it was never
   * reviewed for (see the "tool poisoning" / "rug pull" note in the README).
   */
  allowedTools?: readonly string[];
}

export const McpServerConfigSchema = z.object({
  name: z.string().min(1),
  transport: McpTransportConfigSchema,
  allowedTools: z.array(z.string()).optional(),
});

export const McpServerConfigsSchema = z.array(McpServerConfigSchema).superRefine((servers, ctx) => {
  const seen = new Set<string>();
  for (const [index, server] of servers.entries()) {
    if (seen.has(server.name)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "name"],
        message: `Duplicate MCP server name "${server.name}" — server names must be unique.`,
      });
    }
    seen.add(server.name);
  }
});

/**
 * Validates a list of MCP server configs (e.g. parsed from an `MCP_SERVERS`
 * env var). Throws a descriptive error on invalid shape or duplicate names.
 */
export function parseMcpServerConfigs(value: unknown): McpServerConfig[] {
  return McpServerConfigsSchema.parse(value) as McpServerConfig[];
}
