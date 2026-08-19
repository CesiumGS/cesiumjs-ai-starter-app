/**
 * Loads the CZML Agent Skills (`skills/<name>/SKILL.md`) vendored directly in this package (see
 * `../../skills/`), at module-load time.
 *
 * Each `SKILL.md` file has the same minimal two-field YAML frontmatter (`name`, `description`)
 * followed by a Markdown body as `@cesium-ai/codegen-cesium`'s skills — hand-rolled parsing here
 * too, for the same reason (fixed/flat shape, no new supply-chain surface).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to this package's vendored `skills/` directory, resolved relative to this
 * compiled/source file rather than `process.cwd()` — works identically whether this module runs
 * from `src/pipeline/` (vitest) or `dist/pipeline/` (built), since both are two levels below the
 * package root (mirrors `czml-official-schema.ts`'s `VENDORED_SCHEMA_DIR`).
 */
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../skills");

/** A parsed CZML Agent Skill: frontmatter fields plus the Markdown body. */
export interface CzmlSkill {
  /** Frontmatter `name`, e.g. `czml-orientation`. */
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
function parseSkillFile(raw: string, filePath: string): CzmlSkill {
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

let cachedSkills: CzmlSkill[] | undefined;

/**
 * Loads and parses all `SKILL.md` files under this package's vendored `skills/` directory, one
 * per CZML feature domain. Results are cached after the first call — the vendored files never
 * change during a process's lifetime.
 */
export function loadCzmlSkills(): CzmlSkill[] {
  if (cachedSkills) return cachedSkills;

  const domainDirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("czml-"),
  );
  cachedSkills = domainDirs
    .map((entry) => {
      const filePath = join(SKILLS_DIR, entry.name, "SKILL.md");
      const raw = readFileSync(filePath, "utf8");
      return parseSkillFile(raw, filePath);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return cachedSkills;
}
