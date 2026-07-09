import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RateLimiterOptions {
  /** Max requests allowed per window, per IP. */
  rpm: number;
  /** Sliding window length in milliseconds. Defaults to 60s. */
  windowMs?: number;
}

/**
 * In-process sliding-window rate limiter keyed by client IP.
 *
 * Keeps an array of request timestamps per key and, on each request, drops
 * timestamps older than the window. If the remaining count reaches the limit
 * it responds with HTTP 429 and a `Retry-After` header.
 *
 * **Limitations to consider before production use:**
 * - State is per-process — multiple instances each enforce the limit independently.
 *   Use a shared store (e.g. Redis) when running more than one replica.
 * - Keying by IP requires `app.set('trust proxy', N)` behind a reverse proxy;
 *   without it every request appears to come from the proxy's IP.
 *   `X-Forwarded-For` can also be spoofed if the proxy hop count is not fixed.
 * - For authenticated APIs, consider keying by user/session/API-key instead of IP
 *   so limits track actual clients rather than network addresses.
 */
export function rateLimiter({ rpm, windowMs = 60_000 }: RateLimiterOptions): RequestHandler {
  const hitsByIp = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    const recent = (hitsByIp.get(ip) ?? []).filter((ts) => ts > windowStart);

    if (recent.length >= rpm) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: `Rate limit of ${rpm} requests per minute exceeded. Try again in ${retryAfterSec}s.`,
      });
      // Persist the pruned window so it keeps shrinking as time passes.
      hitsByIp.set(ip, recent);
      return;
    }

    recent.push(now);
    hitsByIp.set(ip, recent);
    next();
  };
}
