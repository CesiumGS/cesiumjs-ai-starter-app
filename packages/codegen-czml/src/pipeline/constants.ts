/**
 * Default values for every user-overridable pipeline option (`generateVerifiedCzml`'s
 * `maxAttempts`/`maxPackets`/`maxLength`/`maxToolSteps`). Consolidated here — rather than left as
 * private constants next to each function — so a caller tuning one of these options can find
 * every current default in one place.
 */

/** Default `maxAttempts` for `generateVerifiedCzml`. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default `maxPackets` for `generateVerifiedCzml`/`verifyCzml` — hard cap on packet count. */
export const DEFAULT_MAX_PACKETS = 200;

/** Default `maxLength` for `generateVerifiedCzml`/`verifyCzml` — hard cap on serialized CZML size in characters. */
export const DEFAULT_MAX_LENGTH = 20_000;

/**
 * Default `maxToolSteps` for `generateVerifiedCzml` — the max number of steps (each a `loadSkill`
 * tool call, or the final structured-output step) the model may take per generation attempt
 * before being forced to stop. Generous enough to let the model load several feature-domain
 * skills (see `skill-tool.ts`) before producing its final CZML output.
 */
export const DEFAULT_MAX_TOOL_STEPS = 6;
