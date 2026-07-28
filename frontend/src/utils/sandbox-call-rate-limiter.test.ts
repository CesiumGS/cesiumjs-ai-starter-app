import { describe, expect, test, vi, afterEach } from "vitest";
import {
  DEFAULT_RATE_LIMIT,
  RateLimitExceededError,
  SandboxCallRateLimiter,
} from "./sandbox-call-rate-limiter.js";

describe("SandboxCallRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows maxCalls calls within the window, then throws on the next", () => {
    const limiter = new SandboxCallRateLimiter({ maxCalls: 3, windowMs: 60_000 });
    expect(() => limiter.checkAndRecord()).not.toThrow();
    expect(() => limiter.checkAndRecord()).not.toThrow();
    expect(() => limiter.checkAndRecord()).not.toThrow();
    expect(() => limiter.checkAndRecord()).toThrow(RateLimitExceededError);
  });

  test("allows calls again once the window has passed", () => {
    vi.useFakeTimers();
    const limiter = new SandboxCallRateLimiter({ maxCalls: 2, windowMs: 1000 });
    limiter.checkAndRecord();
    limiter.checkAndRecord();
    expect(() => limiter.checkAndRecord()).toThrow(RateLimitExceededError);

    vi.advanceTimersByTime(1001);

    expect(() => limiter.checkAndRecord()).not.toThrow();
  });

  test("DEFAULT_RATE_LIMIT is a sensible positive default", () => {
    expect(DEFAULT_RATE_LIMIT.maxCalls).toBeGreaterThan(0);
    expect(DEFAULT_RATE_LIMIT.windowMs).toBeGreaterThan(0);
  });
});
