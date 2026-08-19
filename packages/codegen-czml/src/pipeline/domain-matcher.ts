/**
 * Matches a natural-language intent to the vendored CZML Agent Skill(s) (see `skills-loader.ts`)
 * whose `description` (trigger/activation text) most closely overlaps with the intent's wording.
 * Mirrors `@cesium-ai/codegen-cesium`'s `domain-matcher.ts` exactly (same BM25 scoring, same
 * rationale for computing it inline rather than via the unmaintained `bm25` npm package) — kept
 * as an independent copy rather than a shared dependency so each codegen package stays
 * self-contained, matching this monorepo's existing per-package logger/metrics convention.
 */
import { loadCzmlSkills, type CzmlSkill } from "./skills-loader.js";
import { DEFAULT_SKILL_MATCH_LIMIT, DEFAULT_SKILL_MATCH_THRESHOLD } from "./constants.js";
export { DEFAULT_SKILL_MATCH_LIMIT, DEFAULT_SKILL_MATCH_THRESHOLD };

/** Term-frequency saturation parameter — higher values let repeated terms keep adding score. */
const BM25_K1 = 1.5;
/** Document-length normalization strength (0 = none, 1 = full normalization by length). */
const BM25_B = 0.75;

/**
 * Scores every document in `corpusTokens` against `queryTokens` using Okapi BM25.
 * Returns one score per document, in the same order as `corpusTokens`.
 */
function scoreBm25(queryTokens: string[], corpusTokens: string[][]): number[] {
  const docCount = corpusTokens.length;
  const docLengths = corpusTokens.map((tokens) => tokens.length);
  const avgDocLength = docLengths.reduce((sum, len) => sum + len, 0) / (docCount || 1);

  // Term frequency per document, computed once per query term.
  const termFrequencies = corpusTokens.map((docTokens) => {
    const tf = new Map<string, number>();
    for (const term of new Set(queryTokens)) {
      tf.set(term, docTokens.filter((token) => token === term).length);
    }
    return tf;
  });

  // Document frequency: number of documents containing each query term at least once.
  const docFrequency = new Map<string, number>();
  for (const term of new Set(queryTokens)) {
    let count = 0;
    for (const tf of termFrequencies) {
      if ((tf.get(term) ?? 0) > 0) count++;
    }
    docFrequency.set(term, count);
  }

  // Inverse document frequency (BM25's +1 smoothed variant, keeps IDF non-negative).
  const idf = new Map<string, number>();
  for (const [term, df] of docFrequency) {
    idf.set(term, Math.log((docCount - df + 0.5) / (df + 0.5) + 1));
  }

  return corpusTokens.map((_docTokens, idx) => {
    const docLength = docLengths[idx];
    const termFrequency = termFrequencies[idx];

    let score = 0;
    for (const term of queryTokens) {
      const tf = termFrequency.get(term) ?? 0;
      if (tf === 0) continue;
      const numerator = tf * (BM25_K1 + 1);
      const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
      score += (idf.get(term) ?? 0) * (numerator / denominator);
    }
    return score;
  });
}

/** A skill scored against a given intent, with higher scores indicating a stronger match. */
export interface DomainMatch {
  skill: CzmlSkill;
  score: number;
}

/**
 * Small inline stop-word list covering common English function words that would otherwise dilute
 * token-overlap scoring (e.g. "the", "a", "to") without carrying domain signal.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "and",
  "or",
  "is",
  "are",
  "be",
  "it",
  "this",
  "that",
  "i",
  "want",
  "please",
  "can",
  "you",
  "me",
  "my",
  "using",
  "use",
  "when",
]);

/** Lowercases, splits on non-word characters, and drops stop words / empty tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

/**
 * Scores every skill's `description` against the given intent and returns matches sorted by
 * descending score. Uses BM25 ranking for better discrimination.
 * Defaults `skills` to {@link loadCzmlSkills}'s output; pass an explicit array in tests to avoid
 * depending on the real vendored data.
 */
export function matchSkillsForIntent(
  intent: string,
  skills: CzmlSkill[] = loadCzmlSkills(),
): DomainMatch[] {
  const intentTokens = tokenize(intent);
  const skillTokens = skills.map((skill) => tokenize(skill.description));

  const scores = scoreBm25(intentTokens, skillTokens);

  return skills
    .map((skill, idx) => ({ skill, score: scores[idx] }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Returns the top N best-matching skills for the given intent, ranked by relevance.
 * Filters out matches below the score threshold to exclude weak/marginal matches.
 * Returns fewer than `limit` skills if fewer than `limit` scored above the threshold.
 * Useful when multiple skills are needed to generate comprehensive context for CZML generation.
 *
 * @param intent - The user's natural-language request
 * @param limit - Maximum number of skills to return (default: {@link DEFAULT_SKILL_MATCH_LIMIT})
 * @param threshold - Minimum BM25 score to include a skill (default: {@link DEFAULT_SKILL_MATCH_THRESHOLD}). Set to 0 to disable filtering.
 * @param skills - Optional skill array; defaults to loaded vendored CZML skills
 * @returns Array of skills sorted by BM25 score (highest relevance first), all scoring ≥ threshold
 */
export function matchBestSkills(
  intent: string,
  limit: number = DEFAULT_SKILL_MATCH_LIMIT,
  threshold: number = DEFAULT_SKILL_MATCH_THRESHOLD,
  skills: CzmlSkill[] = loadCzmlSkills(),
): CzmlSkill[] {
  return matchSkillsForIntent(intent, skills)
    .filter((match) => match.score >= threshold)
    .slice(0, limit)
    .map((match) => match.skill);
}
