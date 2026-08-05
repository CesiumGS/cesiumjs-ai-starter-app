import { describe, expect, it, vi } from "vitest";
import { createOAuthClientProvider } from "./oauth-client-provider.js";

describe("createOAuthClientProvider", () => {
  it("exposes the configured redirectUrl and clientMetadata", () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      scope: "assets:read",
      onAuthorizationUrl: vi.fn(),
    });

    expect(provider.redirectUrl).toBe("http://127.0.0.1:8090/callback");
    expect(provider.clientMetadata).toEqual({
      redirect_uris: ["http://127.0.0.1:8090/callback"],
      client_name: "cesium-ai-mcp-tools",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "assets:read",
    });
  });

  it("uses client_secret_post auth method when a clientSecret is configured", () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      clientId: "abc",
      clientSecret: "shh",
      onAuthorizationUrl: vi.fn(),
    });

    expect(provider.clientMetadata.token_endpoint_auth_method).toBe("client_secret_post");
  });

  it("saveTokens/tokens round-trip in memory", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    await expect(provider.tokens()).resolves.toBeUndefined();
    await provider.saveTokens({ access_token: "at", token_type: "Bearer" });
    await expect(provider.tokens()).resolves.toEqual({ access_token: "at", token_type: "Bearer" });
  });

  it("redirectToAuthorization forwards the URL to onAuthorizationUrl", async () => {
    const onAuthorizationUrl = vi.fn();
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl,
    });

    const url = new URL("https://auth.example.com/authorize?client_id=abc");
    await provider.redirectToAuthorization(url);
    expect(onAuthorizationUrl).toHaveBeenCalledWith(url);
  });

  it("codeVerifier throws until one has been saved", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    await expect(provider.codeVerifier()).rejects.toThrow(/No PKCE code verifier/);
    await provider.saveCodeVerifier("verifier-1");
    await expect(provider.codeVerifier()).resolves.toBe("verifier-1");
  });

  it("clientInformation returns the static clientId as-is and ignores dynamic registration updates", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      clientId: "preregistered-id",
      clientSecret: "preregistered-secret",
      onAuthorizationUrl: vi.fn(),
    });

    await expect(provider.clientInformation()).resolves.toEqual({
      client_id: "preregistered-id",
      client_secret: "preregistered-secret",
    });

    // Dynamic-registration flows call this unconditionally after registering — must be a no-op here.
    await provider.saveClientInformation?.({ client_id: "server-issued-id" });
    await expect(provider.clientInformation()).resolves.toEqual({
      client_id: "preregistered-id",
      client_secret: "preregistered-secret",
    });
  });

  it("retains dynamically registered client information in memory", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    await expect(provider.clientInformation()).resolves.toBeUndefined();
    await provider.saveClientInformation?.({ client_id: "server-issued-id" });
    await expect(provider.clientInformation()).resolves.toEqual({ client_id: "server-issued-id" });
  });

  it("state()/saveState()/storedState() round-trip", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    const state = await provider.state?.();
    expect(typeof state).toBe("string");
    await provider.saveState?.(state!);
    await expect(provider.storedState?.()).resolves.toBe(state);
  });

  it("invalidateCredentials('all') clears all in-memory credentials", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    await provider.saveTokens({ access_token: "at", token_type: "Bearer" });
    await provider.saveCodeVerifier("v");
    await provider.invalidateCredentials?.("all");
    await expect(provider.tokens()).resolves.toBeUndefined();
    await expect(provider.codeVerifier()).rejects.toThrow(/No PKCE code verifier/);
  });

  it("invalidateCredentials('tokens') only clears tokens", async () => {
    const provider = createOAuthClientProvider({
      redirectUrl: "http://127.0.0.1:8090/callback",
      onAuthorizationUrl: vi.fn(),
    });

    await provider.saveTokens({ access_token: "at", token_type: "Bearer" });
    await provider.saveCodeVerifier("v");
    await provider.invalidateCredentials?.("tokens");
    await expect(provider.tokens()).resolves.toBeUndefined();
    await expect(provider.codeVerifier()).resolves.toBe("v");
  });
});
