import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const CODEGEN_PACKAGE_JSON_PATH = join(REPO_ROOT, "packages", "codegen-cesium", "package.json");
const OUTPUT_PATH = join(REPO_ROOT, "docs", "generated", "cesiumjs-skills-table.md");

function parseSkillsDependencySpec() {
  const pkg = JSON.parse(readFileSync(CODEGEN_PACKAGE_JSON_PATH, "utf8"));
  const spec = pkg.dependencies?.["@cesium/cesiumjs-skills"];
  if (typeof spec !== "string") {
    throw new Error('Missing "@cesium/cesiumjs-skills" dependency in codegen package.json');
  }

  const match = /^github:([^/]+)\/([^#]+)(?:#(.+))?$/.exec(spec);
  if (!match) {
    throw new Error(`Unsupported skills dependency spec: ${spec}`);
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  const ref = match[3] ?? "main";
  return { owner, repo, ref };
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "cesiumjs-ai-starter-app-docs",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  }
  return response.json();
}

async function loadDomainNamesFromRepo(owner, repo, ref) {
  const encodedRef = encodeURIComponent(ref);
  const skillsDirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/skills?ref=${encodedRef}`;
  const entries = await fetchGitHubJson(skillsDirUrl);
  return entries
    .filter((entry) => entry.type === "dir" && entry.name.startsWith("cesiumjs-"))
    .map((entry) => entry.name)
    .sort();
}

async function main() {
  const { owner, repo, ref } = parseSkillsDependencySpec();
  const domains = await loadDomainNamesFromRepo(owner, repo, ref);

  const lines = [...domains.map((domain) => `- \`${domain}\``), ""];

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}`, "utf8");
  console.log(`Wrote ${domains.length} domains to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
