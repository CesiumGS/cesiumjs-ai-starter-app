/**
 * Default values for every user-overridable pipeline option (`generateVerifiedCzml`'s
 * `maxAttempts`/`maxPackets`/`maxLength`). Consolidated here — rather than left as private
 * constants next to each function — so a caller tuning one of these options can find every
 * current default in one place.
 */

/** Default `maxAttempts` for `generateVerifiedCzml`. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default `maxPackets` for `generateVerifiedCzml`/`verifyCzml` — hard cap on packet count. */
export const DEFAULT_MAX_PACKETS = 200;

/** Default `maxLength` for `generateVerifiedCzml`/`verifyCzml` — hard cap on serialized CZML size in characters. */
export const DEFAULT_MAX_LENGTH = 20_000;
