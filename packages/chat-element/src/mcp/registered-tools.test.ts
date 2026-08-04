import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRegisteredTools } from "./registered-tools";

describe("fetchRegisteredTools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed tool list on a successful response", async () => {
    const tools = [
      { name: "flyTo", description: "Flies the camera somewhere" },
      { name: "mcp__docs__search" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tools }) }));

    const result = await fetchRegisteredTools("http://localhost:3001/api/tools");

    expect(result).toEqual(tools);
  });

  it("returns an empty array when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const result = await fetchRegisteredTools("http://localhost:3001/api/tools");

    expect(result).toEqual([]);
  });

  it("returns an empty array when the response shape doesn't match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notTools: [] }) }),
    );

    const result = await fetchRegisteredTools("http://localhost:3001/api/tools");

    expect(result).toEqual([]);
  });

  it("filters out malformed entries instead of throwing", async () => {
    const tools = [{ name: "flyTo" }, { description: "no name field" }, { name: 42 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tools }) }));

    const result = await fetchRegisteredTools("http://localhost:3001/api/tools");

    expect(result).toEqual([{ name: "flyTo" }]);
  });

  it("returns an empty array when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await fetchRegisteredTools("http://localhost:3001/api/tools");

    expect(result).toEqual([]);
  });
});
