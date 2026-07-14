import { describe, expect, test, vi, afterEach } from "vitest";
import type { Viewer } from "cesium";
import {
  assertEntityCapNotExceeded,
  DEFAULT_MAX_ENTITIES,
  DEFAULT_RATE_LIMIT,
  EntityCapExceededError,
  RateLimitExceededError,
  SandboxCallRateLimiter,
} from "./execution-guards.js";

describe("assertEntityCapNotExceeded", () => {
  function mockViewer(entityCount: number): Viewer {
    return {
      entities: { values: new Array(entityCount).fill({}) },
    } as unknown as Viewer;
  }

  test("does not throw when below the cap", () => {
    const viewer = mockViewer(5);
    expect(() => assertEntityCapNotExceeded(viewer, { maxEntities: 10 })).not.toThrow();
  });

  test("throws EntityCapExceededError once the count reaches the cap", () => {
    const viewer = mockViewer(10);
    expect(() => assertEntityCapNotExceeded(viewer, { maxEntities: 10 })).toThrow(
      EntityCapExceededError,
    );
  });

  test("throws once the count exceeds the cap", () => {
    const viewer = mockViewer(15);
    expect(() => assertEntityCapNotExceeded(viewer, { maxEntities: 10 })).toThrow(
      EntityCapExceededError,
    );
  });

  test("uses DEFAULT_MAX_ENTITIES as a sensible default", () => {
    expect(DEFAULT_MAX_ENTITIES).toBeGreaterThan(0);
    const viewer = mockViewer(DEFAULT_MAX_ENTITIES);
    expect(() => assertEntityCapNotExceeded(viewer, { maxEntities: DEFAULT_MAX_ENTITIES })).toThrow(
      EntityCapExceededError,
    );
  });
});

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