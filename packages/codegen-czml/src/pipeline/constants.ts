/**
 * Default values for every user-overridable pipeline option (`generateVerifiedCzml`'s
 * `maxAttempts`/`maxPackets`/`maxLength`/`maxSkills`/`threshold`, and `matchBestSkills`'s
 * `limit`/`threshold`). Consolidated here — rather than left as private constants next to each
 * function — so a caller tuning one of these options can find every current default in one place.
 */

/** Default `maxAttempts` for `generateVerifiedCzml`. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default `maxPackets` for `generateVerifiedCzml`/`verifyCzml` — hard cap on packet count. */
export const DEFAULT_MAX_PACKETS = 200;

/** Default `maxLength` for `generateVerifiedCzml`/`verifyCzml` — hard cap on serialized CZML size in characters. */
export const DEFAULT_MAX_LENGTH = 20_000;

/** Default `maxSkills`/`limit` for `generateVerifiedCzml` and `matchBestSkills` — max feature-domain skills matched, inlined as grounding context, and/or returned. */
export const DEFAULT_SKILL_MATCH_LIMIT = 3;
/** Default `threshold` for `matchBestSkills` — minimum BM25 score to include a skill. */
export const DEFAULT_SKILL_MATCH_THRESHOLD = 0.5;
