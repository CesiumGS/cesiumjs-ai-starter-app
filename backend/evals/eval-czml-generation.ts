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
import { generateVerifiedCzml } from "@cesium-ai/codegen-czml";
import { CZML_EVAL_CASES, exampleUrl, type CzmlEvalCase } from "./czml-eval-cases.js";

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
  | { name: string; status: "verified_and_matched"; entityCount: number; durationMs: number }
  | {
      name: string;
      status: "verified_but_missing_expected_properties";
      entityCount: number;
      missingProperties: string[];
      durationMs: number;
    }
  | { name: string; status: "rejected"; violations: string[]; durationMs: number }
  | { name: string; status: "generation_error"; error: string; durationMs: number };

async function runCase(
  evalCase: CzmlEvalCase,
  model: Awaited<ReturnType<typeof createModel>>,
): Promise<CaseOutcome> {
  const start = Date.now();
  const result = await generateVerifiedCzml({ intent: evalCase.intent, model });
  const durationMs = Date.now() - start;

  if (!result.verified) {
    return {
      name: evalCase.name,
      status: "rejected",
      violations: result.violations ?? [result.error],
      durationMs,
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
    };
  }

  return {
    name: evalCase.name,
    status: "verified_and_matched",
    entityCount: result.entityCount,
    durationMs,
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
        `${statusIcon(outcome.status)} ${outcome.name} (${outcome.durationMs}ms) — ${outcome.status}`,
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

  console.log(
    `\nSummary: ${passed}/${outcomes.length} fully passed, ${partial} verified-but-partial, ` +
      `${rejected} rejected by the verifier, ${errored} generation error(s).`,
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
