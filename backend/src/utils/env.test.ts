import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `env.ts` parses `process.env` at module-load time (top-level `parsed`), so
 * each test resets the module registry and re-imports with a controlled
 * environment. `dotenv.config` is a no-op here since no `.env` file exists
 * relative to the test's `process.cwd()`.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...overrides };
  return import("./env.js");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("env parsing", () => {
  it("applies defaults when nothing is set", async () => {
    const { env } = await loadEnv({
      PUBLIC_URL: undefined,
      AI_PROVIDER: undefined,
      ALLOWED_ORIGIN: undefined,
      RATE_LIMIT_RPM: undefined,
      CODEGEN_MAX_SKILLS: undefined,
      CODEGEN_MAX_ATTEMPTS: undefined,
      TELEMETRY_ENABLED: undefined,
    });

    expect(env.PUBLIC_URL).toBe("http://localhost:3001");
    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.ALLOWED_ORIGIN).toEqual(["http://localhost:5173"]);
    expect(env.RATE_LIMIT_RPM).toBe(20);
    expect(env.CODEGEN_MAX_SKILLS).toBe(1);
    expect(env.CODEGEN_MAX_ATTEMPTS).toBe(3);
    expect(env.TELEMETRY_ENABLED).toBe(false);
  });

  it("rejects an invalid AI_PROVIDER value", async () => {
    await expect(loadEnv({ AI_PROVIDER: "not-a-provider" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });

  it("rejects a malformed PUBLIC_URL", async () => {
    await expect(loadEnv({ PUBLIC_URL: "not-a-url" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });

  describe("blankToUndefined coercion", () => {
    it("treats a blank OPENAI_API_KEY as unset rather than an empty string", async () => {
      const { env } = await loadEnv({ OPENAI_API_KEY: "   " });
      expect(env.OPENAI_API_KEY).toBeUndefined();
    });

    it("treats a blank AI_BASE_URL as unset instead of failing url validation", async () => {
      const { env } = await loadEnv({ AI_BASE_URL: "" });
      expect(env.AI_BASE_URL).toBeUndefined();
    });

    it("keeps a non-blank OPENAI_API_KEY", async () => {
      const { env } = await loadEnv({ OPENAI_API_KEY: "sk-test" });
      expect(env.OPENAI_API_KEY).toBe("sk-test");
    });
  });

  describe("boolEnv truthy/falsy parsing", () => {
    it.each([
      ["1", true],
      ["true", true],
      ["TRUE", true],
      ["yes", true],
      ["on", true],
      ["0", false],
      ["false", false],
      ["no", false],
      ["off", false],
      ["garbage", false],
    ])("parses TELEMETRY_ENABLED=%s as %s", async (value, expected) => {
      const { env } = await loadEnv({ TELEMETRY_ENABLED: value });
      expect(env.TELEMETRY_ENABLED).toBe(expected);
    });

    it("falls back to the default when blank", async () => {
      const { env: telemetryEnv } = await loadEnv({ TELEMETRY_ENABLED: "" });
      expect(telemetryEnv.TELEMETRY_ENABLED).toBe(false);
    });
  });

  describe("ALLOWED_ORIGIN comma-splitting", () => {
    it("splits and trims a comma-separated list", async () => {
      const { env } = await loadEnv({
        ALLOWED_ORIGIN: "http://a.example, http://b.example ,http://c.example",
      });

      expect(env.ALLOWED_ORIGIN).toEqual([
        "http://a.example",
        "http://b.example",
        "http://c.example",
      ]);
    });

    it("falls back to the default origin when blank", async () => {
      const { env } = await loadEnv({ ALLOWED_ORIGIN: "" });
      expect(env.ALLOWED_ORIGIN).toEqual(["http://localhost:5173"]);
    });
  });

  it("coerces RATE_LIMIT_RPM to a positive integer", async () => {
    const { env } = await loadEnv({ RATE_LIMIT_RPM: "42" });
    expect(env.RATE_LIMIT_RPM).toBe(42);
  });

  it("rejects a non-positive RATE_LIMIT_RPM", async () => {
    await expect(loadEnv({ RATE_LIMIT_RPM: "0" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });

  it("coerces CODEGEN_MAX_SKILLS to a positive integer", async () => {
    const { env } = await loadEnv({ CODEGEN_MAX_SKILLS: "3" });
    expect(env.CODEGEN_MAX_SKILLS).toBe(3);
  });

  it("rejects a non-positive CODEGEN_MAX_SKILLS", async () => {
    await expect(loadEnv({ CODEGEN_MAX_SKILLS: "0" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });

  it("coerces CODEGEN_MAX_ATTEMPTS to a positive integer", async () => {
    const { env } = await loadEnv({ CODEGEN_MAX_ATTEMPTS: "5" });
    expect(env.CODEGEN_MAX_ATTEMPTS).toBe(5);
  });

  it("rejects a non-positive CODEGEN_MAX_ATTEMPTS", async () => {
    await expect(loadEnv({ CODEGEN_MAX_ATTEMPTS: "0" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });

  it("rejects a malformed OTEL_EXPORTER_OTLP_ENDPOINT", async () => {
    await expect(loadEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url" })).rejects.toThrow(
      /Invalid environment configuration/i,
    );
  });
});
