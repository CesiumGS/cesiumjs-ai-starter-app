import { resolve } from "node:path";
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from "@cesium-ai/mcp-tools/constants";
import type { McpServerConfig } from "@cesium-ai/mcp-tools/types";
import dotenv from "dotenv";
import { z } from "zod";
import { resolveMcpServersConfig } from "./mcp-servers-config.js";

// Loads .env files when present (local dev). quiet: true silently skips missing
// files, so this is a no-op in production where env vars come from the runtime.
// override: true makes .env win over any pre-existing process.env value (e.g. a
// stray User/Machine-level OTEL_* var set for other local tools) so this app's
// config is always exactly what .env says, without touching that other var.
dotenv.config({
  path: [resolve(process.cwd(), "../.env"), resolve(process.cwd(), ".env")],
  quiet: true,
  override: true,
});

// Treats blank/whitespace-only values as "unset". .env files spell an unset
// optional as `KEY=` (an empty string, not absent), but `z.string().optional()`
// keeps that "", and `z.url().optional()` rejects it outright. Coercing blanks
// to undefined lets defaults apply and keeps empty optionals from throwing.
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// Parses the common truthy/falsy string spellings that env var files use.
// z.coerce.boolean() cannot be used because it treats any non-empty string as true.
const boolEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.trim()) return defaultValue;
      return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
    });

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;

const EnvSchema = z.object({
  PUBLIC_URL: z.url().default("http://localhost:3001"),

  AI_PROVIDER: z.enum(["openai", "anthropic", "google"]).default("openai"),

  OPENAI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  GOOGLE_GENERATIVE_AI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),

  AI_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
  AI_BASE_URL: z.preprocess(blankToUndefined, z.url().optional()),

  ALLOWED_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim() !== ""
        ? value.split(",").map((origin) => origin.trim())
        : ["http://localhost:5173"],
    ),

  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(20),

  // Max number of matched skills inlined as grounding context in the executeCesiumCode prompt.
  CODEGEN_MAX_SKILLS: z.coerce.number().int().positive().default(1),

  // Minimum BM25 score a skill must reach to be considered a match for the executeCesiumCode
  // prompt (`matchBestSkill`'s `threshold`). Matches that function's own default of 1.0. Set to
  // 0 to disable filtering entirely.
  CODEGEN_SKILL_THRESHOLD: z.coerce.number().nonnegative().default(1.0),

  // Max regeneration attempts if a generated executeCesiumCode snippet fails verification.
  CODEGEN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

  // Hard cap on generated executeCesiumCode source size in characters, passed through to the AST
  // verifier (`verifyCesiumCode`'s `maxLength`). Matches that function's own default of 4000.
  CODEGEN_MAX_CODE_LENGTH: z.coerce.number().int().positive().default(4000),

  // Hard cap on generated executeCesiumCode line count, passed through to the AST verifier
  // (`verifyCesiumCode`'s `maxLines`). Matches that function's own default of 100.
  CODEGEN_MAX_CODE_LINES: z.coerce.number().int().positive().default(100),

  // Optional comma-separated free-identifier allowlist passed through to the AST verifier
  // (`verifyCesiumCode`'s `allowedSymbols`). Unset/blank preserves the current default of no
  // allowlist restriction (any identifier not otherwise banned is permitted).
  CODEGEN_ALLOWED_SYMBOLS: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim() !== "" ? value.split(",").map((symbol) => symbol.trim()) : undefined,
    ),

  // Optional extra instructions appended to the executeCesiumCode generation prompt's output
  // rules (`buildCodegenPrompt`'s `extraInstructions`), e.g. app-specific constraints or house
  // style preferences. Unset/blank appends nothing.
  CODEGEN_EXTRA_INSTRUCTIONS: z.preprocess(blankToUndefined, z.string().optional()),

  TELEMETRY_ENABLED: boolEnv(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
  OTEL_EXPORTER_OTLP_HEADERS: z.preprocess(blankToUndefined, z.string().optional()),
  OTEL_SERVICE_NAME: z
    .preprocess(blankToUndefined, z.string().optional())
    .default("cesiumjs-ai-starter-app-backend"),
  OTEL_SERVICE_NAMESPACE: z
    .preprocess(blankToUndefined, z.string().optional())
    .default("cesium-ai"),
  OTEL_RESOURCE_ATTRIBUTES: z.preprocess(blankToUndefined, z.string().optional()),
  OTEL_LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),

  // Per-tool-call timeout for MCP tools (ms). The server list is resolved
  // separately below from `mcp.config.json`, not as a plain zod field here.
  MCP_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_MCP_TOOL_TIMEOUT_MS),

  // Signs the session-ID cookie used to key any auto-detected, auth-required
  // MCP server's connection (a server whose startup attempt failed with a
  // 401 — see `createMcpTools`'s `authRequiredServers`). Required whenever
  // session-scoped MCP connections are enabled.
  SESSION_SECRET: z.preprocess(blankToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof EnvSchema> & { mcpServers: McpServerConfig[] };

const parsed = EnvSchema.safeParse(process.env);
const mcpConfig = resolveMcpServersConfig();

const issues: string[] = [];
if (!parsed.success) {
  issues.push(
    ...parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  );
}
if ("issues" in mcpConfig) {
  issues.push(...mcpConfig.issues.map((message) => `  - MCP configuration: ${message}`));
}
if (issues.length > 0) {
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

// Both branches above throw before reaching here, so `parsed.success` and
// `mcpConfig.result` are both guaranteed — narrow explicitly rather than an
// unchecked `as` cast on the exported `env` object itself.
const baseEnv = (parsed as Extract<typeof parsed, { success: true }>).data;
const { mcpServers } = (mcpConfig as Extract<typeof mcpConfig, { result: unknown }>).result as {
  mcpServers: McpServerConfig[];
};

export const env: Env = { ...baseEnv, mcpServers };
