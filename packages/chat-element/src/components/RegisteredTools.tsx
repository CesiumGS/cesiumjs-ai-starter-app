import { useRef, useState } from "react";
import { IconButton, Popover, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgCesium from "@stratakit/icons/cesium.svg";
import svgConfiguration from "@stratakit/icons/configuration.svg";
import svgMcpServer from "@stratakit/icons/mcp-server.svg";
import { MCP_TOOL_PREFIX, parseMcpToolName } from "../mcp/mcp-tool-name";
import type { RegisteredTool } from "../mcp/registered-tools";
import { McpConnect } from "./McpConnect";
import { ToolGroup, filterToolsForGroup } from "./ToolGroup";
import { spanVariantMapping } from "../utils/ui-constants";
import styles from "./AiChatPanel.module.css";

/**
 * Groups MCP tools by their originating server, preserving first-seen order.
 * Each tool's `name` is rewritten to just its bare, un-namespaced form (e.g.
 * `list_actively_monitored_assets` instead of
 * `mcp__itwiniotai__list_actively_monitored_assets`) — the `MCP: <server>`
 * group heading already conveys which server it came from, so repeating
 * that server name inside every single tool row is pure noise.
 */
function groupMcpToolsByServer(tools: RegisteredTool[]): Map<string, RegisteredTool[]> {
  const groups = new Map<string, RegisteredTool[]>();
  for (const tool of tools) {
    const parsed = parseMcpToolName(tool.name);
    const server = parsed?.server ?? "mcp";
    const displayTool: RegisteredTool = parsed ? { ...tool, name: parsed.displayName } : tool;
    const existing = groups.get(server);
    if (existing) {
      existing.push(displayTool);
    } else {
      groups.set(server, [displayTool]);
    }
  }
  return groups;
}

export interface RegisteredToolsProps {
  /**
   * The currently registered tool set (see `useRegisteredTools`/
   * `fetchRegisteredTools`) — owned by the host (`AiChatPanel`) rather than
   * fetched internally, so it can be shared with other consumers (e.g. the
   * MCP Apps widget lookup in `ToolCard`) without fetching it twice.
   */
  tools: RegisteredTool[];
  /**
   * Re-fetches `tools` — called on `McpConnect`'s `onConnectionChange` so a
   * newly-connected session server's tools show up immediately, without
   * waiting for the panel to be closed and reopened.
   */
  refetchTools: () => void;
  /**
   * Base URL for session-scoped, user-initiated MCP OAuth connect routes
   * (e.g. "Connect to Cesium ion") — see `@cesium-ai/server`'s
   * `mcp-session-router.ts`. When provided, a "Connect" group (see
   * `McpConnect`) is rendered inside this SAME popover/list, alongside the
   * tool groups above, rather than as a separate toggle/list of its own.
   */
  mcpConnectApiBase?: string;
}

/**
 * Popup (anchored to a toggle button in the panel header) showing every tool
 * currently registered on the host's backend, split into independently
 * collapsible groups: one per dynamically-connected MCP server (namespaced
 * `mcp__<server>__<tool>`) plus a final "Built-in tools" group. When
 * `mcpConnectApiBase` is also provided, a "Connect" group (session-scoped,
 * user-initiated MCP OAuth servers — see `McpConnect`) renders in the same
 * popover/list.
 *
 * `tools`/`refetchTools` are owned by the host — see `RegisteredToolsProps`.
 * Session-connectable server names (via `McpConnect`'s `onServerNames`) are
 * excluded from this component's own MCP-group rendering — `McpConnect`
 * renders those itself — so each server appears only once. Renders nothing
 * if there are no tools and no session-connectable servers.
 */
export function RegisteredTools({ tools, refetchTools, mcpConnectApiBase }: RegisteredToolsProps) {
  const [sessionServerNames, setSessionServerNames] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (tools.length === 0 && !mcpConnectApiBase) return null;

  const mcpTools = tools.filter((tool) => tool.name.startsWith(MCP_TOOL_PREFIX));
  const packageTools = tools.filter((tool) => !tool.name.startsWith(MCP_TOOL_PREFIX));
  const mcpToolsByServer = groupMcpToolsByServer(mcpTools);
  const query = searchQuery.trim().toLowerCase();

  // Session-connectable servers render themselves (via `McpConnect`, passed
  // `mcpToolsByServer` below) once connected, so exclude them here to avoid
  // showing the same "MCP: <server>" group twice.
  const operatorMcpGroups = [...mcpToolsByServer.entries()].filter(
    ([server]) => !sessionServerNames.includes(server),
  );

  return (
    <div className={styles.toolsPanel}>
      <Tooltip title={isOpen ? "Hide registered tools" : "Configure tools ..."}>
        <IconButton
          ref={anchorRef}
          size="small"
          aria-label="Configure tools ..."
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className={styles.toolsToggle}
        >
          <Icon href={svgConfiguration} className={styles.toolsToggleIcon} />
        </IconButton>
      </Tooltip>

      <Popover
        open={isOpen}
        anchorEl={anchorRef.current}
        onClose={() => setIsOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: styles.toolsPopover } }}
      >
        <div className={styles.toolsPopoverHeader}>
          <Typography
            variantMapping={spanVariantMapping}
            variant="caption"
            className={styles.toolsPopoverDescription}
          >
            Tools currently available to the assistant.
          </Typography>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search tools…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Search tools" } }}
            className={styles.toolsSearchField}
            fullWidth
          />
        </div>
        <div className={styles.toolsList} data-testid="registered-tools-list">
          {operatorMcpGroups.map(([server, serverTools]) => (
            <ToolGroup
              key={server}
              title={
                <>
                  <Icon href={svgMcpServer} className={styles.toolGroupTitleIcon} /> {server}
                </>
              }
              tools={filterToolsForGroup(`${server}`, serverTools, query)}
              connected
            />
          ))}
          <ToolGroup
            title={
              <>
                <Icon href={svgCesium} className={styles.toolGroupTitleIcon} /> Built-in tools
              </>
            }
            tools={filterToolsForGroup("Built-in tools", packageTools, query)}
          />
          {mcpConnectApiBase && (
            <McpConnect
              apiBase={mcpConnectApiBase}
              filter={searchQuery}
              serverTools={mcpToolsByServer}
              onServerNames={setSessionServerNames}
              onConnectionChange={refetchTools}
            />
          )}
        </div>
      </Popover>
    </div>
  );
}
