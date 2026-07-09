/**
 * CesiumJS symbol allowlist, parsed from the `docs/DOMAINS.md` document shipped by the
 * `@cesium/cesiumjs-skills` package dependency.
 *
 * `DOMAINS.md` is the machine-readable side of the CesiumJS Agent Skills data: per-domain sections
 * (`## Domain N: <name> (~N entries)`), each containing `### <subheading>` groups of `- Symbol`
 * bullet lines mapping individual CesiumJS symbols (classes, functions, enums) to the domain skill
 * that documents them. This module parses those sections once per process and exposes the result
 * as a queryable in-memory allowlist.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export interface SymbolAllowlistEntry {
  symbol: string;
  domain: string;
}

const require = createRequire(import.meta.url);

const DOMAINS_MD_PATH = path.join(
  path.dirname(require.resolve("@cesium/cesiumjs-skills/package.json")),
  "docs",
  "DOMAINS.md",
);

const DOMAIN_HEADING_PATTERN = /^##\s+Domain\s+\d+:\s+`?([a-zA-Z0-9-]+)`?/;

/**
 * Parses the per-domain `- Symbol` bullet lists out of `DOMAINS.md`.
 *
 * Walks the document top to bottom, tracking which `## Domain N: <name>` section is currently
 * active. Any other top-level `## ` heading (e.g. `## Cross-Cutting Ownership Rules`, `## Recently
 * Added APIs`) closes the active domain, so bullets in those non-domain sections are never
 * collected. Within an active domain, only `- ` bullet lines are read (prose under a `### Notes` or
 * `### Ownership Rule` subheading is written as blockquotes or plain sentences, not bullets, and is
 * skipped automatically).
 *
 * Some bullets are shorthand groups sharing a prefix, e.g.
 * `Camera.move / moveForward / moveBackward` — these expand into `Camera.move`, `Camera.moveForward`,
 * `Camera.moveBackward`. A trailing parenthetical annotation (e.g. `GeoJsonPrimitive (v1.142)`) is
 * stripped before parsing. Any bullet segment that still contains whitespace after that (i.e. isn't
 * a bare symbol/dotted-path token) is treated as prose and discarded.
 */
function parseDomainsMarkdown(markdown: string): SymbolAllowlistEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: SymbolAllowlistEntry[] = [];
  const symbolTokenPattern = /^[A-Za-z_$][A-Za-z0-9_$.]*$/;

  let currentDomain: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const domainMatch = DOMAIN_HEADING_PATTERN.exec(line);
    if (domainMatch) {
      currentDomain = domainMatch[1];
      continue;
    }
    if (line.startsWith("## ")) {
      // A non-domain top-level heading — stop attributing bullets to any domain.
      currentDomain = undefined;
      continue;
    }
    if (!currentDomain || !line.startsWith("- ")) continue;

    const bulletText = line.slice(2).trim();
    const withoutTrailingParenthetical = bulletText.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const segments = withoutTrailingParenthetical
      .split(" / ")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) continue;

    const firstDotIndex = segments[0].lastIndexOf(".");
    const sharedPrefix = firstDotIndex === -1 ? undefined : segments[0].slice(0, firstDotIndex + 1);

    segments.forEach((segment, index) => {
      const symbol =
        index > 0 && sharedPrefix && !segment.includes(".") ? sharedPrefix + segment : segment;
      if (!symbolTokenPattern.test(symbol)) return; // prose, not a symbol token
      entries.push({ symbol, domain: currentDomain! });
    });
  }

  if (entries.length === 0) {
    throw new Error(
      `Could not find any "## Domain N: <name>" symbol bullets in ${DOMAINS_MD_PATH}`,
    );
  }

  return entries;
}

let cachedEntries: SymbolAllowlistEntry[] | undefined;

/**
 * Parses and caches (module-level, once per process) every domain's symbol bullets from the
 * `@cesium/cesiumjs-skills` package's `docs/DOMAINS.md`.
 */
export function loadAllowedSymbols(): SymbolAllowlistEntry[] {
  if (!cachedEntries) {
    const markdown = readFileSync(DOMAINS_MD_PATH, "utf-8");
    cachedEntries = parseDomainsMarkdown(markdown);
  }
  return cachedEntries;
}

/**
 * Returns the allowed symbol names, optionally filtered to a single domain (e.g. `cesiumjs-camera`).
 * Omit `domain` to get every symbol across all domains, deduped.
 */
export function getAllowedSymbols(domain?: string): string[] {
  const entries = loadAllowedSymbols();
  const filtered =
    domain === undefined ? entries : entries.filter((entry) => entry.domain === domain);
  return Array.from(new Set(filtered.map((entry) => entry.symbol)));
}

/**
 * Convenience boolean check for whether `symbol` is present in the allowlist, optionally scoped to
 * a single `domain`.
 */
export function isSymbolAllowed(symbol: string, domain?: string): boolean {
  return getAllowedSymbols(domain).includes(symbol);
}

/**
 * Intersects a list of candidate symbols with a sandbox's actually-exposed capability surface.
 *
 * General-purpose utility for a caller that wants to narrow a broader symbol list down to what a
 * specific sandbox instance exposes. NOTE: `@cesium-ai/codegen-cesium`'s own
 * `generateVerifiedCesiumCode` does NOT use this to build its enforcement allowlist — see that
 * module's comment for why intersecting `DOMAINS.md`'s CesiumJS class/method names against the
 * sandbox's bare proxy-function names (different namespaces) would incorrectly collapse to a
 * near-empty allowlist. This helper remains useful for a future capability surface whose names are
 * themselves real CesiumJS symbol names.
 *
 * Returns symbols present in both lists (case-sensitive exact match), deduped, in an order stable
 * relative to `symbols` (the first argument).
 */
export function intersectWithCapabilities(
  symbols: string[],
  exposedCapabilities: readonly string[],
): string[] {
  const exposed = new Set(exposedCapabilities);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const symbol of symbols) {
    if (exposed.has(symbol) && !seen.has(symbol)) {
      seen.add(symbol);
      result.push(symbol);
    }
  }

  return result;
}
