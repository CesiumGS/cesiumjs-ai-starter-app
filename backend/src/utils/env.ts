import { resolve } from "node:path";
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

const EnvSchema = z.object({
  PUBLIC_URL: z.url().default("http://localhost:3001"),

  AI_PROVIDER: z.enum(["openai", "anthropic", "google"]).default("openai"),

  OPENAI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  GOOGLE_GENERATIVE_AI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),

  AI_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
  AI_BASE_URL: z.preprocess(blankToUndefined, z.url().optional()),

  CHAT_ENABLED: boolEnv(true),

  ALLOWED_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim() !== ""
        ? value.split(",").map((origin) => origin.trim())
        : ["http://localhost:5173"],
    ),

  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(20),

  TELEMETRY_ENABLED: boolEnv(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
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
