/**
 * Matches a natural-language intent to the vendored CesiumJS Agent Skill(s) whose `description`
 * (trigger/activation text) most closely overlaps with the intent's wording.
 *
 * The scoring uses BM25 (Best Matching 25), a probabilistic ranking function from information
 * retrieval that considers term frequency and document length — better than Jaccard similarity
 * for discriminating between skills. Routes "fly the camera to Paris" to the camera skill and
 * "add a GeoJSON polygon" to the entities skill with improved accuracy.
 *
 * BM25 is computed inline rather than via the `bm25` npm package: that package (last published
 * 2016, unmaintained — its README now points to the `retrieval` package instead) only builds a
 * static doc-term weight matrix for a fixed corpus and has no API for scoring a new query against
 * it, so it can't support the query-vs-corpus matching this module needs.
 */
import { loadCesiumSkills, type CesiumSkill } from "./skills-loader.js";
import { DEFAULT_SKILL_MATCH_LIMIT, DEFAULT_SKILL_MATCH_THRESHOLD } from "./constants.js";
// Re-exported so existing consumers (e.g. this package's index.ts) can keep importing these
// user-overridable defaults from domain-matcher.js, their original home.
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

  // Term frequency per document, computed once per query term (exact match, plus prefix match
  // against compound API-name tokens like "flyto" for a query term like "fly").
  const termFrequencies = corpusTokens.map((docTokens) => {
    const tf = new Map<string, number>();
    for (const term of new Set(queryTokens)) {
      tf.set(term, countTermOccurrences(term, docTokens));
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
  skill: CesiumSkill;
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
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
  return tokens;
}

/**
 * Query terms that also appear inside compound CesiumJS API-name tokens which survive
 * tokenization as a single word (e.g. "flyTo" -> "flyto"). Without this, a query word like "fly"
 * would never match a skill description that only mentions the concept via the API name
 * "flyTo" — even though it's a strong domain signal. Deliberately a small, explicit list (rather
 * than generic prefix/stemming matching) so it doesn't also pick up unrelated matches like the
 * English inflection "load" -> "loading".
 */
// `Object.create(null)`: avoids inherited `Object.prototype` properties (e.g. "constructor",
// "toString") shadowing lookups for tokenized words that happen to match those names.
const COMPOUND_TERM_ALIASES: Record<string, string[]> = Object.assign(Object.create(null), {
  fly: ["flyto"],
});

/**
 * Counts how many times `term` occurs in `docTokens`, treating an exact match as one occurrence
 * and also counting occurrences of any known compound-token alias for `term` (see
 * {@link COMPOUND_TERM_ALIASES}).
 */
function countTermOccurrences(term: string, docTokens: string[]): number {
  const aliases = COMPOUND_TERM_ALIASES[term];
  let count = 0;
  for (const token of docTokens) {
    if (token === term || aliases?.includes(token)) {
      count++;
    }
  }
  return count;
}

/**
 * Scores every skill's `description` against the given intent and returns matches sorted by
 * descending score. Uses BM25 ranking for better discrimination.
 * Defaults `skills` to {@link loadCesiumSkills}'s output; pass an explicit array in tests to avoid
 * depending on the real vendored data.
 */
export function matchSkillsForIntent(
  intent: string,
  skills: CesiumSkill[] = loadCesiumSkills(),
): DomainMatch[] {
  const intentTokens = tokenize(intent);
  const skillTokens = skills.map((skill) => tokenize(skill.description));

  // Score each skill's description (as the BM25 corpus) against the intent (the query).
  const scores = scoreBm25(intentTokens, skillTokens);

  const matches = skills
    .map((skill, idx) => ({
      skill,
      score: scores[idx],
    }))
    .sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Returns the top N best-matching skills for the given intent, ranked by relevance.
 * Filters out matches below the score threshold to exclude weak/marginal matches.
 * Returns fewer than `limit` skills if fewer than `limit` scored above the threshold.
 * Useful when multiple skills are needed to generate comprehensive context for code generation.
 *
 * @param intent - The user's natural-language request
 * @param limit - Maximum number of skills to return (default: {@link DEFAULT_SKILL_MATCH_LIMIT})
 * @param threshold - Minimum BM25 score to include a skill (default: {@link DEFAULT_SKILL_MATCH_THRESHOLD}). Set to 0 to disable filtering.
 * @param skills - Optional skill array; defaults to loaded vendored CesiumJS skills
 * @returns Array of skills sorted by BM25 score (highest relevance first), all scoring ≥ threshold
 */
export function matchBestSkills(
  intent: string,
  limit: number = DEFAULT_SKILL_MATCH_LIMIT,
  threshold: number = DEFAULT_SKILL_MATCH_THRESHOLD,
  skills: CesiumSkill[] = loadCesiumSkills(),
): CesiumSkill[] {
  return matchSkillsForIntent(intent, skills)
    .filter((match) => match.score >= threshold)
    .slice(0, limit)
    .map((match) => match.skill);
}
