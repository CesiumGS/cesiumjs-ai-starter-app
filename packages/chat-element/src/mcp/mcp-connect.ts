/** One MCP server a browser session can interactively connect to via OAuth. */
export interface SessionMcpServersResponse {
  servers: string[];
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

/**
 * Fetches the list of session-connectable MCP server names from a host's
 * `apiBase` (e.g. this repo's backend's `GET /api/mcp/session/servers`).
 * Best-effort: resolves to an empty array on any network failure or
 * unexpected response shape, matching `fetchRegisteredTools`'s convention.
 */
export async function fetchSessionMcpServers(apiBase: string): Promise<string[]> {
  const data = await getJson<SessionMcpServersResponse>(`${apiBase}/session/servers`);
  return Array.isArray(data?.servers)
    ? data.servers.filter((name) => typeof name === "string")
    : [];
}

/** Whether the current browser session already has a live connection to `server`, and (if not) the last recorded failure reason, if any. */
export async function fetchMcpConnectionStatus(
  apiBase: string,
  server: string,
): Promise<{ connected: boolean; error?: string }> {
  const data = await getJson<{ connected?: boolean; error?: string }>(
    `${apiBase}/${encodeURIComponent(server)}/status`,
  );
  return {
    connected: data?.connected === true,
    error: typeof data?.error === "string" ? data.error : undefined,
  };
}

/**
 * Begins the interactive OAuth flow for `server` on behalf of the current
 * browser session, returning either the authorization URL to open (e.g. in
 * a popup) or an error message describing why the attempt couldn't start.
 * The OAuth client used is always the host's own env-configured one for
 * this server — there is no way for the browser to supply its own.
 */
export async function beginMcpConnect(
  apiBase: string,
  server: string,
): Promise<{ authorizationUrl: string } | { error: string }> {
  try {
    const res = await fetch(`${apiBase}/${encodeURIComponent(server)}/connect`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await res.json().catch(() => undefined)) as
      { authorizationUrl?: unknown; error?: unknown } | undefined;
    if (res.ok && typeof data?.authorizationUrl === "string") {
      return { authorizationUrl: data.authorizationUrl };
    }
    return {
      error:
        typeof data?.error === "string" ? data.error : `Connect request failed (${res.status}).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Connect request failed." };
  }
}

/** Closes the current browser session's connection to `server`, if any. */
export async function disconnectMcpServer(apiBase: string, server: string): Promise<void> {
  await getJson(`${apiBase}/${encodeURIComponent(server)}/disconnect`, { method: "POST" });
}
