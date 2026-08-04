import { describe, expect, it } from "vitest";
import { isUnauthorizedMcpError } from "./mcp-error.js";

function mcpClientError(message: string, statusCode?: number): Error {
  const error = new Error(message) as Error & { statusCode?: number };
  error.name = "MCPClientError";
  if (statusCode !== undefined) error.statusCode = statusCode;
  return error;
}

describe("isUnauthorizedMcpError", () => {
  it("returns true for an MCPClientError with statusCode 401", () => {
    expect(isUnauthorizedMcpError(mcpClientError("POSTing to endpoint (HTTP 401): ", 401))).toBe(
      true,
    );
  });

  it("returns true for an MCPClientError whose message embeds (HTTP 401), with no statusCode field", () => {
    expect(isUnauthorizedMcpError(mcpClientError("POSTing to endpoint (HTTP 401): "))).toBe(true);
  });

  it("returns false for an MCPClientError with a different statusCode", () => {
    expect(isUnauthorizedMcpError(mcpClientError("POSTing to endpoint (HTTP 500): ", 500))).toBe(
      false,
    );
  });

  it("returns false for a plain Error that isn't an MCPClientError", () => {
    expect(isUnauthorizedMcpError(new Error("ECONNREFUSED"))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isUnauthorizedMcpError("some string")).toBe(false);
    expect(isUnauthorizedMcpError(undefined)).toBe(false);
  });
});
