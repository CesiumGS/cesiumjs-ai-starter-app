import { describe, expect, it } from "vitest";
import {
  createModel,
  createProviderConfig,
  DEFAULT_MODELS,
  isProviderConfigured,
} from "./providers.js";
import type { Env } from "./env.js";

/**
 * Unit tests for provider selection. These run fully offline: constructing an
 * AI SDK model instance does not make a network call, and the "not configured"
 * / "missing key" paths short-circuit before any SDK is invoked.
 */

/** Build a minimal {@link Env} carrying just the fields providers.ts reads. */
function fakeEnv(overrides: Partial<Env>): Env {
  return {
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    GOOGLE_GENERATIVE_AI_API_KEY: undefined,
    AI_MODEL: undefined,
    AI_BASE_URL: undefined,
    ...overrides,
  } as Env;
}

describe("createProviderConfig", () => {
  it("maps the selected provider's API key from the environment", () => {
    const config = createProviderConfig(
      fakeEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test" }),
    );

    expect(config.provider).toBe("anthropic");
    expect(config.apiKey).toBe("sk-ant-test");
  });

  it("leaves apiKey undefined when the selected provider's key is unset", () => {
    const config = createProviderConfig(
      fakeEnv({ AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "ignored" }),
    );

    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBeUndefined();
  });

  it("carries through model and baseURL overrides", () => {
    const config = createProviderConfig(
      fakeEnv({ AI_MODEL: "gpt-4o-mini", AI_BASE_URL: "https://gateway.example/v1" }),
    );

    expect(config.model).toBe("gpt-4o-mini");
    expect(config.baseURL).toBe("https://gateway.example/v1");
  });
});

describe("isProviderConfigured", () => {
  it("is true when an API key is present and the SDK is installed", () => {
    expect(isProviderConfigured({ provider: "openai", apiKey: "sk-test" })).toBe(true);
  });

  it("is false when the API key is missing", () => {
    expect(isProviderConfigured({ provider: "openai" })).toBe(false);
  });
});

describe("createModel", () => {
  it("throws a descriptive error when the API key is missing", async () => {
    await expect(createModel({ provider: "openai" })).rejects.toThrow(/Missing API key/i);
  });

  it("resolves a model using the provider default when no model id is given", async () => {
    const model = await createModel({ provider: "openai", apiKey: "sk-test" });

    expect(model).toBeDefined();
    expect((model as { modelId: string }).modelId).toBe(DEFAULT_MODELS.openai);
  });

  it("honours an explicit model id override", async () => {
    const model = await createModel({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });

    expect((model as { modelId: string }).modelId).toBe("gpt-4o-mini");
  });
});
