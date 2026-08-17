/**
 * Default values for every user-overridable pipeline option (`generateVerifiedCesiumCode`'s
 * `maxAttempts`/`maxSkills`/`threshold`/`maxLength`/`maxLines`, and `matchBestSkill`'s
 * `limit`/`threshold`). Consolidated here — rather than left as private constants next to each
 * function — so a caller tuning one of these options can find every current default in one place.
 *
 * Constants with no corresponding option (BM25 weights, stop words, banned globals, etc.) stay
 * local to the module that owns them; only defaults an API consumer can actually pass in belong
 * here.
 */

/** Default `maxAttempts` for `generateVerifiedCesiumCode`. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default `maxSkills`/`limit` for `generateVerifiedCesiumCode` and `matchBestSkill` — max skills matched, inlined as grounding context, and/or returned. */
export const DEFAULT_SKILL_MATCH_LIMIT = 3;
/** Default `threshold` for `matchBestSkill` — minimum BM25 score to include a skill. */
export const DEFAULT_SKILL_MATCH_THRESHOLD = 1.0;

/** Default `maxLength` for `verifyCesiumCode` — hard cap on source size in characters. */
export const DEFAULT_MAX_LENGTH = 4000;
/** Default `maxLines` for `verifyCesiumCode` — hard cap on line count. */
export const DEFAULT_MAX_LINES = 100;
