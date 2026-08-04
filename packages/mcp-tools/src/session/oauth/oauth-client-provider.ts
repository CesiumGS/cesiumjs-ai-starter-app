import { randomUUID } from "node:crypto";
import type {
  OAuthAuthorizationServerInformation,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";

interface OAuthState {
  clientInformation?: OAuthClientInformation;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  state?: string;
  authorizationServerInformation?: OAuthAuthorizationServerInformation;
}

export interface CreateOAuthClientProviderOptions {
  /** Public backend callback URL registered for this session OAuth client. */
  redirectUrl: string;
  /** Requested OAuth scope(s), space-separated. */
  scope?: string;
  /** Pre-registered client_id — skips RFC 7591 dynamic client registration. */
  clientId?: string;
  /** Pre-registered client_secret, only meaningful alongside `clientId`. */
  clientSecret?: string;
  /** `client_name` sent during dynamic registration. Ignored when `clientId` is set. */
  clientName?: string;
  /** Called with the URL the browser must open to sign in and grant access. */
  onAuthorizationUrl: (url: URL) => void | Promise<void>;
}

/**
 * Builds the in-memory `OAuthClientProvider` driven by `@ai-sdk/mcp`'s
 * `auth()` and HTTP/SSE transports. One provider is created per browser
 * session connection and discarded on disconnect.
 *
 * Supports:
 * - RFC 7591 dynamic client registration when no `clientId` is configured —
 *   `auth()` calls `registerClient()` automatically the first time
 *   `clientInformation()` resolves `undefined`.
 * - A pre-registered `clientId`/`clientSecret` (e.g. from a manual OAuth app
 *   registration, like Cesium ion's developer console) — used as-is and
 *   never persisted/overwritten.
 * - PKCE (S256) and token refresh — both fully implemented by `@ai-sdk/mcp`'s
 *   `auth()`; this provider only needs to store/retrieve the code verifier,
 *   tokens, and client/authorization-server metadata it's handed.
 */
export function createOAuthClientProvider(
  options: CreateOAuthClientProviderOptions,
): OAuthClientProvider {
  const { redirectUrl, scope, clientId, clientSecret, clientName, onAuthorizationUrl } = options;
  let stored: OAuthState = {};

  // A config-supplied clientId is owned by the operator, not us — always
  // returned as-is and never persisted/overwritten by dynamic registration.
  const staticClientInformation: OAuthClientInformation | undefined = clientId
    ? { client_id: clientId, client_secret: clientSecret }
    : undefined;

  return {
    async tokens() {
      return stored.tokens;
    },
    async saveTokens(tokens: OAuthTokens) {
      stored = { ...stored, tokens };
    },
    async redirectToAuthorization(authorizationUrl: URL) {
      await onAuthorizationUrl(authorizationUrl);
    },
    async saveCodeVerifier(codeVerifier: string) {
      stored = { ...stored, codeVerifier };
    },
    async codeVerifier() {
      if (!stored.codeVerifier) {
        throw new Error(
          "No PKCE code verifier is stored — the authorization flow must be started (redirectToAuthorization) before a code can be exchanged.",
        );
      }
      return stored.codeVerifier;
    },
    get redirectUrl() {
      return redirectUrl;
    },
    get clientMetadata(): OAuthClientMetadata {
      return {
        redirect_uris: [redirectUrl],
        client_name: clientName ?? "cesium-ai-mcp-tools",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: clientSecret ? "client_secret_post" : "none",
        scope,
      };
    },
    async clientInformation() {
      if (staticClientInformation) return staticClientInformation;
      return stored.clientInformation;
    },
    async saveClientInformation(clientInformation: OAuthClientInformation) {
      if (staticClientInformation) return;
      stored = { ...stored, clientInformation };
    },
    async authorizationServerInformation() {
      return stored.authorizationServerInformation;
    },
    async saveAuthorizationServerInformation(info: OAuthAuthorizationServerInformation) {
      stored = { ...stored, authorizationServerInformation: info };
    },
    async state() {
      return randomUUID();
    },
    async saveState(state: string) {
      stored = { ...stored, state };
    },
    async storedState() {
      return stored.state;
    },
    async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier") {
      if (scope === "all") {
        stored = {};
        return;
      }
      if (scope === "client") stored = { ...stored, clientInformation: undefined };
      if (scope === "tokens") stored = { ...stored, tokens: undefined };
      if (scope === "verifier") stored = { ...stored, codeVerifier: undefined };
    },
  };
}
