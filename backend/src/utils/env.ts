import { resolve } from "node:path";
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  McpServerConfigsSchema,
  type McpServerConfig,
} from "@cesium-ai/mcp-tools";
import dotenv from "dotenv";
import { z } from "zod";

// Loads .env files when present (local dev). quiet: true silently skips missing
// files, so this is a no-op in production where env vars come from the runtime.
dotenv.config({
  path: [resolve(process.cwd(), "../.env"), resolve(process.cwd(), ".env")],
  quiet: true,
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

// MCP_SERVERS is a JSON array of McpServerConfig — trusted, operator-supplied
// config only (never derived from a chat request). Blank/unset -> no MCP
// servers configured, a zero-behavior-change default.
const mcpServersEnv = z
  .string()
  .optional()
  .transform((value, ctx): McpServerConfig[] => {
    if (!value || !value.trim()) return [];
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "MCP_SERVERS must be valid JSON." });
      return z.NEVER;
    }
    const result = McpServerConfigsSchema.safeParse(json);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: `MCP_SERVERS is invalid: ${result.error.message}` });
      return z.NEVER;
    }
    return result.data as McpServerConfig[];
  });

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

  // Optional MCP (Model Context Protocol) servers to connect to — see
  // @cesium-ai/mcp-tools. JSON array of { name, transport, allowedTools? }.
  // Empty/unset means MCP support stays fully off.
  MCP_SERVERS: mcpServersEnv,
  // Per-tool-call timeout for MCP tools (ms).
  MCP_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_MCP_TOOL_TIMEOUT_MS),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env: Env = parsed.data;
