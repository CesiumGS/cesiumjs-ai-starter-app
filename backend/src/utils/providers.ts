import { createRequire } from "node:module";
import type { LanguageModel } from "ai";
import type { Env } from "./env.js";

const require = createRequire(import.meta.url);

/**
 * Provider selection and SDK instantiation live in the app, not in
 * `@cesium-ai/server` — choosing a provider is the host's decision, and the
 * host owns the API keys. The server package stays model-agnostic and just
 * receives the {@link LanguageModel} produced here.
 */

/** Supported LLM providers. */
export type AIProvider = "openai" | "anthropic" | "google";

/** Provider configuration resolved from the environment (see env.ts). */
export interface ProviderConfig {
  /** Which provider SDK to instantiate. */
  provider: AIProvider;
  /** API key for the provider. When absent the provider is "not configured". */
  apiKey?: string;
  /** Optional model id override. Falls back to {@link DEFAULT_MODELS}. */
  model?: string;
  /** Optional custom base URL (proxy / gateway / self-hosted endpoint). */
  baseURL?: string;
}

/** Default model id used for each provider when `model` is not set. */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4.1",
  anthropic: "claude-opus-4-8",
  google: "gemini-2.5-pro",
};

/** Maps each provider to the `@ai-sdk/*` package that must be installed for it. */
const PROVIDER_PACKAGES: Record<AIProvider, string> = {
  openai: "@ai-sdk/openai",
  anthropic: "@ai-sdk/anthropic",
  google: "@ai-sdk/google",
};

/** True when the provider's SDK package is resolvable at runtime. */
function isProviderSDKInstalled(provider: AIProvider): boolean {
  try {
    require.resolve(PROVIDER_PACKAGES[provider]);
    return true;
  } catch {
    return false;
  }
}

/** True when the given provider config carries an API key and its SDK is installed. */
export function isProviderConfigured(config: ProviderConfig): boolean {
  return Boolean(config.apiKey) && isProviderSDKInstalled(config.provider);
}

/** Resolves a {@link ProviderConfig} from validated environment variables. */
export function createProviderConfig(env: Env): ProviderConfig {
  const apiKeyByProvider: Record<AIProvider, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    google: env.GOOGLE_GENERATIVE_AI_API_KEY,
  };

  return {
    provider: env.AI_PROVIDER,
    apiKey: apiKeyByProvider[env.AI_PROVIDER],
    model: env.AI_MODEL,
    baseURL: env.AI_BASE_URL,
  };
}

/**
 * Loads the provider SDK on demand. `@ai-sdk/openai` ships as a runtime
 * dependency (the default provider works out of the box); the other providers
 * are devDependencies, so selecting one requires installing its package. A
 * missing package surfaces as an actionable install hint rather than a raw
 * module-resolution error.
 */
async function importProvider(provider: AIProvider): Promise<{
  create: (opts: { apiKey: string; baseURL?: string }) => (modelId: string) => LanguageModel;
}> {
  try {
    switch (provider) {
      case "openai": {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return { create: createOpenAI };
      }
      case "anthropic": {
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        return { create: createAnthropic };
      }
      case "google": {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        return { create: createGoogleGenerativeAI };
      }
    }
  } catch {
    const pkg = PROVIDER_PACKAGES[provider];
    throw new Error(
      `Provider "${provider}" is selected but its SDK is not installed. Run \`npm install ${pkg}\` to enable it.`,
    );
  }
}

/**
 * Resolves the AI SDK model instance for the given provider config.
 *
 * Throws a descriptive error when the API key is missing, or when the selected
 * provider's SDK package is not installed. Guard with {@link isProviderConfigured}
 * first when you want a graceful "not configured" path instead.
 */
export async function createModel(config: ProviderConfig): Promise<LanguageModel> {
  const { provider, apiKey, model, baseURL } = config;

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". Set the corresponding API key to enable chat.`,
    );
  }

  const modelId = model ?? DEFAULT_MODELS[provider];
  const { create } = await importProvider(provider);
  return create({ apiKey, baseURL })(modelId);
}
