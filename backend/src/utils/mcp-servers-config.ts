import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServerConfigsSchema, type McpServerConfig } from "@cesium-ai/mcp-tools";

/**
 * Conventional on-disk MCP server config file, checked in this order — the
 * same dual-path pattern `env.ts` uses for `.env` (repo root when
 * `process.cwd()` is `backend/`, or the repo root itself). This is the sole
 * source for the server list.
 */
const MCP_CONFIG_CANDIDATE_PATHS = [
  resolve(process.cwd(), "../mcp.config.json"),
  resolve(process.cwd(), "mcp.config.json"),
];

function findMcpConfigFile(): string | undefined {
  return MCP_CONFIG_CANDIDATE_PATHS.find((path) => existsSync(path));
}

export type McpServersConfigSource = "file" | "default";

export interface McpServersConfigResult {
  servers: McpServerConfig[];
  /** Where the (possibly empty) server list came from — useful for a startup log. */
  source: McpServersConfigSource;
  /** Only set when `source === "file"`. */
  sourcePath?: string;
}

/**
 * Resolves the full list of configured MCP servers from `mcp.config.json`
 * (see {@link MCP_CONFIG_CANDIDATE_PATHS}), or returns an empty list when no
 * file exists — a zero-behavior-change default. Whether a server needs
 * per-user OAuth is auto-detected later (see `createMcpTools`'s
 * `authRequiredServers`) — there's no static flag to set here.
 *
 * Never throws — validation failures are returned as `{ issues }` so
 * `env.ts` can fold them into its own "Invalid environment configuration"
 * error alongside any other env var problem.
 */
export function resolveMcpServersConfig():
  { result: McpServersConfigResult } | { issues: string[] } {
  const configFile = findMcpConfigFile();

  let raw: unknown;
  let sourceLabel: string;

  if (configFile) {
    sourceLabel = configFile;
    try {
      raw = JSON.parse(readFileSync(configFile, "utf8"));
    } catch (err) {
      return {
        issues: [
          `MCP config file (${configFile}) is not valid JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ],
      };
    }
  } else {
    return { result: { servers: [], source: "default" } };
  }

  const parsed = McpServerConfigsSchema.safeParse(raw);
  if (!parsed.success) {
    return { issues: [`${sourceLabel} is invalid: ${parsed.error.message}`] };
  }

  return {
    result: {
      servers: parsed.data as McpServerConfig[],
      source: "file",
      sourcePath: configFile,
    },
  };
}
