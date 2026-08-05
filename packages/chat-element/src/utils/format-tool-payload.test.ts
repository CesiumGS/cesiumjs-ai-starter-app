import { describe, expect, it } from "vitest";
import { formatToolPayload } from "./format-tool-payload";

describe("formatToolPayload", () => {
  it("JSON-formats a plain non-object payload", () => {
    expect(formatToolPayload(true)).toBe("true");
    expect(formatToolPayload(null)).toBe("null");
    expect(formatToolPayload("hello")).toBe('"hello"');
  });

  it("renders top-level multi-line string fields as raw text with a blank line, other fields as compact JSON", () => {
    const result = formatToolPayload({ code: "line1\nline2", ok: true });
    expect(result).toBe("code:\nline1\nline2\n\nok: true");
  });

  it("renders scalar-only fields as pretty-printed JSON", () => {
    const payload = { success: true, longitude: 25.28, latitude: 54.6872, heading: 360 };
    expect(formatToolPayload(payload)).toBe(JSON.stringify(payload, null, 2));
  });

  it("pretty-prints an MCP text part that is itself a JSON string", () => {
    const inner = { items: [{ id: 624, name: "Cesium OSM Buildings" }], total: 1 };
    const payload = {
      content: [{ type: "text", text: JSON.stringify(inner) }],
      isError: false,
    };

    const result = formatToolPayload(payload);

    expect(result).toBe(JSON.stringify(inner, null, 2));
    // The escaped raw form must not leak through un-formatted.
    expect(result).not.toContain('\\"');
    expect(result).not.toContain("\\n");
  });

  it("joins multiple MCP text parts with a blank line between them", () => {
    const payload = {
      content: [
        { type: "text", text: "first part" },
        { type: "text", text: JSON.stringify({ a: 1 }) },
      ],
    };

    expect(formatToolPayload(payload)).toBe(`first part\n\n${JSON.stringify({ a: 1 }, null, 2)}`);
  });

  it("leaves a non-JSON MCP text part as verbatim text", () => {
    const payload = { content: [{ type: "text", text: "plain, non-JSON text" }] };
    expect(formatToolPayload(payload)).toBe("plain, non-JSON text");
  });

  it("prefixes rendered MCP content with [error] when isError is true", () => {
    const payload = { content: [{ type: "text", text: "boom" }], isError: true };
    expect(formatToolPayload(payload)).toBe("[error]\nboom");
  });

  it("falls back to generic formatting when content isn't the MCP text-part shape", () => {
    const payload = { content: [{ type: "image", data: "base64..." }] };
    const result = formatToolPayload(payload);
    // Not recognized as MCP text content -> falls back to plain pretty-printed JSON.
    expect(result).toBe(JSON.stringify(payload, null, 2));
  });

  it("falls back to generic formatting when content is an empty array", () => {
    const payload = { content: [] as unknown[] };
    expect(formatToolPayload(payload)).toBe(JSON.stringify(payload, null, 2));
  });
});
