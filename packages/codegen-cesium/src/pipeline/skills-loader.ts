/**
 * Loads the CesiumJS Agent Skills (`skills/<name>/SKILL.md`) shipped by the
 * `@cesium/cesiumjs-skills` package dependency, at module-load time. This is backend-only
 * (Node `fs`), so it's safe to read files from disk synchronously.
 *
 * Each `SKILL.md` file has a minimal two-field YAML frontmatter (`name`, `description`) followed
 * by a Markdown body. We hand-roll the frontmatter parsing rather than pulling in a YAML
 * dependency: the shape is fixed and flat (no nesting, no lists), so a line-based parser is
 * simpler and has no new supply-chain surface.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Absolute path to the `skills/` directory inside the installed `@cesium/cesiumjs-skills`
 * package. Resolved via `require.resolve` on the package's own `package.json` rather than a
 * relative `node_modules` path, so this keeps working regardless of hoisting in the npm
 * workspace.
 */
const DOMAINS_DIR = join(
  dirname(require.resolve("@cesium/cesiumjs-skills/package.json")),
  "skills",
);

/** A parsed CesiumJS Agent Skill: frontmatter fields plus the Markdown body. */
export interface CesiumSkill {
  /** Frontmatter `name`, e.g. `cesiumjs-camera`. */
  name: string;
  /** Frontmatter `description` — trigger/activation text used for domain matching. */
  description: string;
  /** Markdown body content (everything after the closing `---`). */
  body: string;
  /** Absolute path to the source `SKILL.md` file. */
  filePath: string;
}

const FRONTMATTER_DELIMITER = "---";

/**
 * Splits a `SKILL.md` file's raw text into its frontmatter block and body. Expects the file to
 * start with a `---` line, followed by `name:`/`description:` fields, then a closing `---` line.
 */
function parseSkillFile(raw: string, filePath: string): CesiumSkill {
  const lines = raw.split(/\r?\n/);

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    throw new Error(`Expected frontmatter delimiter "---" at start of ${filePath}`);
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FRONTMATTER_DELIMITER,
  );
  if (closingIndex === -1) {
    throw new Error(`Missing closing frontmatter delimiter "---" in ${filePath}`);
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const bodyLines = lines.slice(closingIndex + 1);
  const body = bodyLines.join("\n").trimStart();

  let name: string | undefined;
  let description: string | undefined;

  for (const line of frontmatterLines) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = stripQuotes(rawValue.trim());
    if (key === "name") name = value;
    else if (key === "description") description = value;
  }

  if (!name) throw new Error(`Missing "name" field in frontmatter of ${filePath}`);
  if (!description) throw new Error(`Missing "description" field in frontmatter of ${filePath}`);

  return { name, description, body, filePath };
}

/** Strips a single layer of matching double quotes from a frontmatter scalar value, if present. */
function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

let cachedSkills: CesiumSkill[] | undefined;

/**
 * Loads and parses all `SKILL.md` files shipped by the `@cesium/cesiumjs-skills` package, one per
 * domain subdirectory under `skills/`. Results are cached after the first call — the installed
 * package's files never change during a process's lifetime.
 */
export function loadCesiumSkills(): CesiumSkill[] {
  if (cachedSkills) return cachedSkills;

  // The package also ships `using-cesiumjs-skills/`, a bootstrap/orientation skill (not a domain
  // skill) meant for plugin-install onboarding rather than codegen grounding — excluded here.
  const domainDirs = readdirSync(DOMAINS_DIR, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("cesiumjs-"),
  );
  cachedSkills = domainDirs
    .map((entry) => {
      const filePath = join(DOMAINS_DIR, entry.name, "SKILL.md");
      const raw = readFileSync(filePath, "utf8");
      return parseSkillFile(raw, filePath);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return cachedSkills;
}
