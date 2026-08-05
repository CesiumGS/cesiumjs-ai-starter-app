import { describe, expect, it, vi } from "vitest";
import { createSessionMiddleware } from "./session.js";

describe("createSessionMiddleware", () => {
  it("rejects a blank session secret", () => {
    expect(() => createSessionMiddleware({ secret: "  " })).toThrow(/SESSION_SECRET must be set/);
  });

  it("accepts an environment-provided session secret", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => createSessionMiddleware({ secret: "an-environment-secret" })).not.toThrow();
  });
});
