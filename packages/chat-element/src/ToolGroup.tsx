import { useState, type ReactNode } from "react";
import { Collapse, IconButton, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgChevronDown from "@stratakit/icons/chevron-down.svg";
import svgChevronRight from "@stratakit/icons/chevron-right.svg";
import svgCheckmark from "@stratakit/icons/status-success.svg";
import svgDisconnect from "@stratakit/icons/disconnect.svg";
import type { RegisteredTool } from "./registered-tools";
import { spanVariantMapping } from "./ui-constants";
import styles from "./AiChatPanel.module.css";

/**
 * Filters `groupTools` down to entries matching `query` (case-insensitive
 * substring, checked against each tool's name and description) — unless
 * `groupLabel` itself matches, in which case the whole group is kept as-is
 * (so e.g. typing "maps" keeps every tool under the "MCP: maps" group, not
 * just ones whose own name happens to contain "maps"). A blank `query`
 * always returns `groupTools` unchanged.
 *
 * Shared between {@link file://./RegisteredTools.tsx} (operator-configured
 * MCP/built-in groups) and {@link file://./McpConnect.tsx}
 * (session-scoped, user-connected servers), so both apply identical search
 * semantics.
 */
export function filterToolsForGroup(
  groupLabel: string,
  groupTools: RegisteredTool[],
  query: string,
): RegisteredTool[] {
  if (!query) return groupTools;
  if (groupLabel.toLowerCase().includes(query)) return groupTools;
  return groupTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) ||
      (tool.description?.toLowerCase().includes(query) ?? false),
  );
}

export interface ToolGroupProps {
  title: ReactNode;
  tools: RegisteredTool[];
  /**
   * Shows a "Connected" status checkmark next to the title — used for
   * MCP-server groups, since their tools only ever appear here at all once
   * the backend has actually connected to that server. Not set for the
   * generic "Built-in tools" group, which has no separate connection state.
   */
  connected?: boolean;
  /**
   * When set, renders a small "Disconnect" icon button alongside the header
   * — used by `McpConnect` for a session-scoped server the user has
   * connected their own account to (unlike an operator-configured server,
   * which has no user-facing disconnect action).
   */
  onDisconnect?: () => void;
}

/** One independently-collapsible group of tools within the disclosure. */
export function ToolGroup({ title, tools, connected, onDisconnect }: ToolGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (tools.length === 0) return null;

  const header = (
    <button
      type="button"
      className={styles.toolGroupHeader}
      onClick={() => setIsOpen((open) => !open)}
      aria-expanded={isOpen}
    >
      <Icon href={isOpen ? svgChevronDown : svgChevronRight} className={styles.toolGroupIcon} />
      <Typography variantMapping={spanVariantMapping} className={styles.toolGroupTitle}>
        {title} ({tools.length})
      </Typography>
      {connected && (
        <Tooltip title="Connected">
          <span className={styles.mcpConnectStatusIcon}>
            <Icon href={svgCheckmark} className={styles.mcpConnectStatusIconOk} />
          </span>
        </Tooltip>
      )}
    </button>
  );

  return (
    <div className={styles.toolGroup}>
      {onDisconnect ? (
        <div className={styles.toolGroupHeaderRow}>
          {header}
          <Tooltip title="Disconnect">
            <IconButton
              size="small"
              aria-label="Disconnect"
              onClick={onDisconnect}
              className={styles.toolGroupDisconnectButton}
            >
              <Icon href={svgDisconnect} className={styles.toolGroupDisconnectIcon} />
            </IconButton>
          </Tooltip>
        </div>
      ) : (
        header
      )}
      <Collapse in={isOpen}>
        <ul className={styles.toolGroupList}>
          {tools.map((tool) => (
            <li key={tool.name} className={styles.toolGroupItem}>
              {tool.description ? (
                <Tooltip
                  title={tool.description}
                  placement="right"
                  slotProps={{ tooltip: { className: styles.toolDescriptionTooltip } }}
                >
                  <div className={styles.toolGroupItemName}>{tool.name}</div>
                </Tooltip>
              ) : (
                <div className={styles.toolGroupItemName}>{tool.name}</div>
              )}
            </li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}
