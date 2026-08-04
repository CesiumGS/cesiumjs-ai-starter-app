import { describe, expect, it, vi } from "vitest";
import { noopMcpToolsLogger } from "../../logger.js";
import { discoverProtectedResourceScope } from "./discover-protected-resource-scope.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("discoverProtectedResourceScope", () => {
  it("returns scopes_supported joined into a space-separated scope string", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ scopes_supported: ["assets:list", "assets:read"] }),
    );

    const scope = await discoverProtectedResourceScope(
      "http://localhost:3000/mcp/",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(scope).toBe("assets:list assets:read");
    expect(fetchFn).toHaveBeenCalledWith(
      new URL("http://localhost:3000/.well-known/oauth-protected-resource/mcp"),
    );
  });

  it("falls back to the origin-root well-known URL when the path-specific one 404s", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ scopes_supported: ["mcp:tools"] }));

    const scope = await discoverProtectedResourceScope(
      "https://server.com/mcp",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(scope).toBe("mcp:tools");
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      new URL("https://server.com/.well-known/oauth-protected-resource/mcp"),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      new URL("https://server.com/.well-known/oauth-protected-resource"),
    );
  });

  it("only tries the root well-known URL for a server URL with no path", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ scopes_supported: ["mcp:tools"] }));

    await discoverProtectedResourceScope(
      "https://server.com",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      new URL("https://server.com/.well-known/oauth-protected-resource"),
    );
  });

  it("returns undefined when the document omits scopes_supported entirely", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ resource: "http://localhost:3000/mcp" }));

    const scope = await discoverProtectedResourceScope(
      "http://localhost:3000/mcp/",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(scope).toBeUndefined();
  });

  it("returns undefined and never throws when every candidate URL fails to fetch", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const scope = await discoverProtectedResourceScope(
      "http://localhost:3000/mcp/",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(scope).toBeUndefined();
  });

  it("returns undefined when the response is a non-ok status other than 404", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }));

    const scope = await discoverProtectedResourceScope(
      "http://localhost:3000/mcp/",
      noopMcpToolsLogger,
      fetchFn as unknown as typeof fetch,
    );

    expect(scope).toBeUndefined();
  });
});
