/** One tool a host's `toolsApiEndpoint` reports as currently registered. */
export interface RegisteredTool {
  name: string;
  description?: string;
}

function isRegisteredTool(value: unknown): value is RegisteredTool {
  if (typeof value !== "object" || value === null) return false;
  const { name, description } = value as Record<string, unknown>;
  return typeof name === "string" && (description === undefined || typeof description === "string");
}

/**
 * Fetches the full tool registry a host's chat backend would run against from
 * `endpoint` (e.g. this repo's `backend`'s `GET /api/tools`) — expects a JSON
 * body shaped `{ tools: RegisteredTool[] }`.
 *
 * Best-effort: resolves to an empty array on any network failure or
 * unexpected response shape, since this only powers a transparency/debug UI
 * affordance ({@link RegisteredTools}), never anything the chat pipeline
 * itself depends on.
 */
export async function fetchRegisteredTools(endpoint: string): Promise<RegisteredTool[]> {
  try {
    const res = await fetch(endpoint, { credentials: "include" });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || !("tools" in data)) return [];
    const { tools } = data as Record<string, unknown>;
    if (!Array.isArray(tools)) return [];
    return tools.filter(isRegisteredTool);
  } catch {
    return [];
  }
}
