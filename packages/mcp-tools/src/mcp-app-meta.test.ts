import { describe, expect, it } from "vitest";
import { getMcpAppToolMeta } from "./mcp-app-meta.js";

describe("getMcpAppToolMeta", () => {
  it("returns undefined for missing/non-object meta", () => {
    expect(getMcpAppToolMeta(undefined)).toBeUndefined();
    expect(getMcpAppToolMeta(null)).toBeUndefined();
    expect(getMcpAppToolMeta("nope")).toBeUndefined();
    expect(getMcpAppToolMeta([])).toBeUndefined();
  });

  it("returns undefined when meta has no `ui` object", () => {
    expect(getMcpAppToolMeta({})).toBeUndefined();
    expect(getMcpAppToolMeta({ ui: "not an object" })).toBeUndefined();
  });

  it("returns undefined when `ui.resourceUri` is missing or not a `ui://` URI", () => {
    expect(getMcpAppToolMeta({ ui: {} })).toBeUndefined();
    expect(getMcpAppToolMeta({ ui: { resourceUri: 42 } })).toBeUndefined();
    expect(
      getMcpAppToolMeta({ ui: { resourceUri: "https://example.com/widget" } }),
    ).toBeUndefined();
  });

  it("extracts a valid resourceUri with no visibility", () => {
    expect(getMcpAppToolMeta({ ui: { resourceUri: "ui://widget/launcher" } })).toEqual({
      resourceUri: "ui://widget/launcher",
    });
  });

  it("extracts and filters visibility to only known values", () => {
    expect(
      getMcpAppToolMeta({
        ui: { resourceUri: "ui://widget/launcher", visibility: ["model", "app", "bogus", 1] },
      }),
    ).toEqual({
      resourceUri: "ui://widget/launcher",
      visibility: ["model", "app"],
    });
  });

  it("omits visibility entirely when it filters down to nothing", () => {
    expect(
      getMcpAppToolMeta({ ui: { resourceUri: "ui://widget/launcher", visibility: ["bogus"] } }),
    ).toEqual({ resourceUri: "ui://widget/launcher" });
  });
});
