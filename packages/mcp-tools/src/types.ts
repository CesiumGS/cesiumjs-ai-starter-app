import { z } from "zod";

/**
 * Optional overrides for a session-scoped OAuth 2.0/2.1 authorization-code +
 * PKCE connection. If `clientId` is omitted, RFC 7591 dynamic client
 * registration is attempted automatically; if set, it's used as-is and
 * never overwritten. PKCE (S256) and token storage are handled by
 * `@ai-sdk/mcp`'s `auth()` — credentials stay in memory for the browser
 * session only.
 *
 * There's no static "this server needs OAuth" flag — whether a server needs
 * interactive auth is auto-detected from its startup connection attempt
 * (see `createMcpTools`'s `authRequiredServers`); `oauth` only supplies
 * overrides once that fires. Scope is normally resolved dynamically from the
 * server's RFC 9728 Protected Resource Metadata, but can be supplied for
 * providers that require it while omitting `scopes_supported`.
 */
export type McpOAuthConfig = {
  /** Pre-registered client_id — skips RFC 7591 dynamic client registration. */
  clientId?: string;
  /** Pre-registered client_secret, only meaningful alongside `clientId`. */
  clientSecret?: string;
  /** `client_name` sent during dynamic registration. Ignored when `clientId` is set. */
  clientName?: string;
  /** Space-separated OAuth scopes. Overrides RFC 9728 scope discovery when provided. */
  scope?: string;
};

const McpOAuthConfigSchema = z
  .object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    clientName: z.string().optional(),
    scope: z.string().min(1).optional(),
  })
  .strict();

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
  /** Optional overrides for the interactive OAuth flow, if this server ever needs one. */
  oauth?: McpOAuthConfig;
};

const McpTransportConfigSchema = z
  .object({
    type: z.enum(["sse", "http"]),
    url: z.url(),
    headers: z.record(z.string(), z.string()).optional(),
    oauth: McpOAuthConfigSchema.optional(),
  })
  .strict();

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

const serverFields = {
  name: z
    .string()
    .min(1)
    .refine((name) => !name.includes("__"), {
      message: 'MCP server names cannot contain "__" because it is the tool namespace delimiter.',
    }),
  allowedTools: z.array(z.string()).optional(),
};

export const McpServerConfigSchema = z
  .object({ ...serverFields, transport: McpTransportConfigSchema })
  .strict();

function uniqueServerNames<T extends { name: string }>(servers: T[], ctx: z.RefinementCtx): void {
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
}

export const McpServerConfigsSchema = z.array(McpServerConfigSchema).superRefine(uniqueServerNames);

/**
 * Validates a list of MCP server configs (e.g. parsed from an
 * `mcp.config.json` file). Throws a descriptive error on invalid shape or
 * duplicate names. One flat list, no manual "does this need OAuth" flag —
 * see `createMcpTools`'s `authRequiredServers`.
 */
export function parseMcpServerConfigs(value: unknown): McpServerConfig[] {
  return McpServerConfigsSchema.parse(value) as McpServerConfig[];
}
