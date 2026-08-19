/**
 * Full-generation eval for the `generateCzml` pipeline: for each case in `czml-eval-cases.ts`,
 * calls the real `generateVerifiedCzml` (real model call + real `verifyCzml`/`CzmlDataSource`
 * verification — never stubbed), so results reflect genuine end-to-end generation quality, not
 * just the verifier's own regression corpus (see `packages/codegen-czml/src/pipeline/czml-verifier.test.ts`
 * for that narrower, verifier-only corpus test).
 *
 * Requires a configured provider (same `.env` as `npm run dev:backend`: `AI_PROVIDER` + its API
 * key). Every run costs real model calls — this is intentionally not part of `npm test`.
 *
 * Usage (from `backend/`):
 *   npx tsx scripts/eval-czml-generation.ts
 *   npx tsx scripts/eval-czml-generation.ts --filter=satellite   # substring match on case name
 *   npx tsx scripts/eval-czml-generation.ts --concurrency=3
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "../src/utils/env.js";
import { createModel, createProviderConfig, isProviderConfigured } from "../src/utils/providers.js";
import {
  generateVerifiedCzml,
  type CodegenLogger,
  type CodegenMetrics,
} from "@cesium-ai/codegen-czml";
import { CZML_EVAL_CASES, exampleUrl, type CzmlEvalCase } from "./czml-eval-cases.js";

/** Per-case generation stats useful for comparing skill-grounding strategies (BM25 vs. dynamic `loadSkill` tool loading), not just pass/fail. */
interface GenerationStats {
  /** Sum of `totalTokens` across every model call the attempt loop made for this case. */
  totalTokens: number;
  /** The 1-based attempt number that produced the returned result (or the last attempted, on failure). */
  attempts: number;
  /** Skill names loaded via the `loadSkill` tool, in call order, across all attempts (empty for the BM25 approach, which never calls a tool). */
  skillsLoaded: string[];
}

/** Builds a fresh `{ metrics, logger, stats }` trio that captures {@link GenerationStats} for one `generateVerifiedCzml` call via its existing metrics/logger seams — no pipeline changes needed. */
function createStatsCollector(): { metrics: CodegenMetrics; logger: CodegenLogger; stats: GenerationStats } {
  const stats: GenerationStats = { totalTokens: 0, attempts: 0, skillsLoaded: [] };
  const metrics: CodegenMetrics = {
    recordTokenUsage: (usage) => {
      stats.totalTokens += usage.totalTokens ?? 0;
    },
    recordSkillMatchScore: () => {},
    recordGenerationDuration: (_durationMs, attributes) => {
      const attempt = Number(attributes?.attempt ?? 0);
      if (attempt > stats.attempts) stats.attempts = attempt;
    },
  };
  const logger: CodegenLogger = {
    debug: (message, meta) => {
      if (message === "Model loaded a CZML skill via loadSkill tool" && typeof meta?.skill === "string") {
        stats.skillsLoaded.push(meta.skill);
      }
    },
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  return { metrics, logger, stats };
}

interface CliOptions {
  filter?: string;
  concurrency: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { concurrency: 2 };
  for (const arg of argv) {
    const filterMatch = /^--filter=(.*)$/.exec(arg);
    const concurrencyMatch = /^--concurrency=(\d+)$/.exec(arg);
    if (filterMatch) options.filter = filterMatch[1];
    else if (concurrencyMatch) options.concurrency = Math.max(1, Number(concurrencyMatch[1]));
  }
  return options;
}

/** Reads a dot-path (e.g. "position.epoch") off a plain object, returning undefined if any segment is missing. */
function getAtPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

/**
 * True if `path` exists on at least one packet in `czml`. Deliberately includes the "document"
 * packet — properties like "clock" legitimately live there (see `czml-reference.ts`), not on
 * entity packets, so excluding it previously caused false "missing" results for clock-related
 * eval cases regardless of whether the model actually generated a correct clock.
 */
function anyPacketHasPath(czml: Record<string, unknown>[], path: string): boolean {
  return czml.some((packet) => getAtPath(packet, path) !== undefined);
}

type CaseOutcome =
  | (GenerationStats & {
      name: string;
      status: "verified_and_matched";
      entityCount: number;
      durationMs: number;
    })
  | (GenerationStats & {
      name: string;
      status: "verified_but_missing_expected_properties";
      entityCount: number;
      missingProperties: string[];
      durationMs: number;
    })
  | (GenerationStats & { name: string; status: "rejected"; violations: string[]; durationMs: number })
  | (GenerationStats & { name: string; status: "generation_error"; error: string; durationMs: number });

async function runCase(
  evalCase: CzmlEvalCase,
  model: Awaited<ReturnType<typeof createModel>>,
): Promise<CaseOutcome> {
  const start = Date.now();
  const { metrics, logger, stats } = createStatsCollector();
  const result = await generateVerifiedCzml({ intent: evalCase.intent, model, metrics, logger });
  const durationMs = Date.now() - start;

  if (!result.verified) {
    return {
      name: evalCase.name,
      status: "rejected",
      violations: result.violations ?? [result.error],
      durationMs,
      ...stats,
    };
  }

  const missingProperties = evalCase.expectedProperties.filter(
    (path) => !anyPacketHasPath(result.czml, path),
  );
  if (missingProperties.length > 0) {
    return {
      name: evalCase.name,
      status: "verified_but_missing_expected_properties",
      entityCount: result.entityCount,
      missingProperties,
      durationMs,
      ...stats,
    };
  }

  return {
    name: evalCase.name,
    status: "verified_and_matched",
    entityCount: result.entityCount,
    durationMs,
    ...stats,
  };
}

/** Runs `tasks` with at most `concurrency` in flight at once, preserving input order in the result array. */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function statusIcon(status: CaseOutcome["status"]): string {
  switch (status) {
    case "verified_and_matched":
      return "✅";
    case "verified_but_missing_expected_properties":
      return "⚠️ ";
    case "rejected":
      return "❌";
    case "generation_error":
      return "🛑";
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const providerConfig = createProviderConfig(env);
  if (!isProviderConfigured(providerConfig)) {
    console.error(
      `Provider "${providerConfig.provider}" is not configured — set its API key in the repo root .env ` +
        `(same setup as \`npm run dev:backend\`) before running this eval.`,
    );
    process.exitCode = 1;
    return;
  }
  const model = await createModel(providerConfig);

  const cases = options.filter
    ? CZML_EVAL_CASES.filter((c) => c.name.includes(options.filter!))
    : CZML_EVAL_CASES;
  if (cases.length === 0) {
    console.error(`No eval cases matched filter "${options.filter}".`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Running ${cases.length} CZML generation eval case(s) against provider "${providerConfig.provider}" ` +
      `(model "${providerConfig.model ?? "(default)"}"), concurrency=${options.concurrency}...\n`,
  );

  const outcomes = await runWithConcurrency(
    cases.map((evalCase) => async () => {
      const outcome = await runCase(evalCase, model);
      console.log(
        `${statusIcon(outcome.status)} ${outcome.name} (${outcome.durationMs}ms, ` +
          `${outcome.attempts} attempt(s), ${outcome.totalTokens} tokens` +
          `${outcome.skillsLoaded.length > 0 ? `, loaded: ${outcome.skillsLoaded.join(", ")}` : ""}) — ${outcome.status}`,
      );
      if (outcome.status === "rejected") {
        outcome.violations.forEach((v) => console.log(`    - ${v}`));
      }
      if (outcome.status === "verified_but_missing_expected_properties") {
        console.log(`    missing: ${outcome.missingProperties.join(", ")}`);
      }
      if (outcome.status === "generation_error") {
        console.log(`    ${outcome.error}`);
      }
      return outcome;
    }),
    options.concurrency,
  );

  const passed = outcomes.filter((o) => o.status === "verified_and_matched").length;
  const partial = outcomes.filter(
    (o) => o.status === "verified_but_missing_expected_properties",
  ).length;
  const rejected = outcomes.filter((o) => o.status === "rejected").length;
  const errored = outcomes.filter((o) => o.status === "generation_error").length;

  const totalTokens = outcomes.reduce((sum, o) => sum + o.totalTokens, 0);
  const avgAttempts = outcomes.reduce((sum, o) => sum + o.attempts, 0) / outcomes.length;
  const avgDurationMs = outcomes.reduce((sum, o) => sum + o.durationMs, 0) / outcomes.length;

  console.log(
    `\nSummary: ${passed}/${outcomes.length} fully passed, ${partial} verified-but-partial, ` +
      `${rejected} rejected by the verifier, ${errored} generation error(s).\n` +
      `Total tokens: ${totalTokens}, avg attempts/case: ${avgAttempts.toFixed(2)}, avg duration/case: ${avgDurationMs.toFixed(0)}ms.`,
  );

  const report = {
    timestamp: new Date().toISOString(),
    provider: providerConfig.provider,
    model: providerConfig.model ?? null,
    cases: outcomes.map((outcome, index) => ({
      ...outcome,
      referenceExamples: cases[index].referenceExamples.map(exampleUrl),
      intent: cases[index].intent,
    })),
  };

  const outDir = resolve(import.meta.dirname, "../eval-results");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `czml-generation-${report.timestamp.replace(/[:.]/g, "-")}.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nFull report written to ${outPath}`);

  if (rejected + errored > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
