import { useCallback, useEffect, useState } from "react";
import { fetchRegisteredTools, type RegisteredTool } from "./registered-tools";

/**
 * Fetches and owns a host's registered tool set (see `fetchRegisteredTools`),
 * re-fetching on mount and whenever `toolsApiEndpoint` changes. Returns
 * `refetchTools` too so a caller can trigger a fresh fetch after an event the
 * hook itself can't observe (e.g. a session MCP server connecting — see
 * `McpConnect`'s `onConnectionChange`).
 *
 * Lifted out of `RegisteredTools` (which used to fetch internally) so
 * `AiChatPanel` can share the SAME fetched tool list with other consumers
 * (e.g. `ToolCard`'s MCP Apps widget lookup) without fetching it twice.
 */
export function useRegisteredTools(toolsApiEndpoint?: string): {
  tools: RegisteredTool[];
  refetchTools: () => void;
} {
  const [tools, setTools] = useState<RegisteredTool[]>([]);

  const refetchTools = useCallback(() => {
    if (!toolsApiEndpoint) {
      setTools([]);
      return;
    }
    fetchRegisteredTools(toolsApiEndpoint).then((fetched) => setTools(fetched));
  }, [toolsApiEndpoint]);

  useEffect(() => {
    refetchTools();
  }, [refetchTools]);

  return { tools, refetchTools };
}
