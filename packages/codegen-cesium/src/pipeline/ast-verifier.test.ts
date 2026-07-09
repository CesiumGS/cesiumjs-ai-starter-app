import { describe, expect, it } from "vitest";
import { SAFE_GLOBAL_IDENTIFIERS, verifyCesiumCode } from "./ast-verifier.js";

const ALLOWED = ["viewer", "Cartesian3", "Viewer"];

describe("verifyCesiumCode — happy path", () => {
  it("passes valid code using only allowed symbols and safe globals", () => {
    const code = `
      const position = Cartesian3.fromDegrees(1, 2, 3);
      viewer.camera.flyTo({ destination: position });
      console.log(Math.max(1, 2));
    `;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });

  it("passes code using top-level `await` (matches the sandbox's async-IIFE execution context)", () => {
    // The frontend sandbox (`code-sandbox.ts`) always executes generated snippets inside an
    // `(async () => { <code> })()` wrapper, so real generated code is expected to use top-level
    // `await`. Regression test for a bug where the verifier's acorn parse config rejected this.
    const code = `await addEntity({ latitude: 1, longitude: 2 });`;
    const result = verifyCesiumCode(code, { allowedSymbols: ["addEntity"] });
    expect(result).toEqual({ verified: true });
  });

  it("when `allowedSymbols` is omitted, allows arbitrary free identifiers not otherwise banned", () => {
    const code = `await anyRandomFunctionName({ foo: 1 });`;
    const result = verifyCesiumCode(code, {});
    expect(result).toEqual({ verified: true });
  });

  it("`allowedSymbols: []` (empty, not omitted) still restricts to only safe globals", () => {
    const code = `await anyRandomFunctionName({ foo: 1 });`;
    const result = verifyCesiumCode(code, { allowedSymbols: [] });
    expect(result.verified).toBe(false);
  });
});

describe("verifyCesiumCode — banned constructs", () => {
  it("rejects eval(...)", () => {
    const result = verifyCesiumCode(`eval("1+1")`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /eval/i.test(v))).toBe(true);
  });

  it("rejects a bare reference to eval", () => {
    const result = verifyCesiumCode(`const e = eval;`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /eval/i.test(v))).toBe(true);
  });

  it("rejects new Function(...)", () => {
    const result = verifyCesiumCode(`const f = new Function("return 1");`, {
      allowedSymbols: ALLOWED,
    });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /Function/.test(v))).toBe(true);
  });

  it("rejects calling Function(...) without new", () => {
    const result = verifyCesiumCode(`Function("return 1")();`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /Function/.test(v))).toBe(true);
  });

  it("rejects dynamic import(...)", () => {
    const result = verifyCesiumCode(`const mod = import("./evil.js");`, {
      allowedSymbols: ALLOWED,
    });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /import/i.test(v))).toBe(true);
  });

  it("rejects fetch(...)", () => {
    const result = verifyCesiumCode(`fetch("https://example.com");`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /fetch/i.test(v))).toBe(true);
  });

  it("rejects window.location as a member-expression root", () => {
    const result = verifyCesiumCode(`const url = window.location;`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /window/i.test(v))).toBe(true);
  });

  it("rejects document, localStorage, XMLHttpRequest, WebSocket, navigator, Worker, postMessage references", () => {
    const snippets = [
      `document.title;`,
      `localStorage.getItem("x");`,
      `new XMLHttpRequest();`,
      `new WebSocket("ws://x");`,
      `navigator.userAgent;`,
      `new Worker("x.js");`,
      `postMessage("x");`,
    ];
    for (const code of snippets) {
      const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
      expect(result.verified).toBe(false);
    }
  });
});

describe("verifyCesiumCode — free identifier allowlist", () => {
  it("rejects a disallowed bare identifier", () => {
    const result = verifyCesiumCode(`someRandomGlobalThing.doStuff();`, {
      allowedSymbols: ALLOWED,
    });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /someRandomGlobalThing/.test(v))).toBe(true);
  });

  it("does not falsely reject a local variable declared and used", () => {
    const code = `const x = 1; const y = x + 1;`;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });

  it("does not falsely reject function parameters used inside the function body", () => {
    const code = `
      function addOne(value) {
        return value + 1;
      }
      addOne(1);
    `;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });

  it("does not falsely reject object literal keys", () => {
    const code = `const obj = { latitude: 10, longitude: 20 };`;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });

  it("does not falsely reject member-expression non-root properties", () => {
    const code = `viewer.camera.flyTo({ destination: viewer.scene.globe.ellipsoid });`;
    const result = verifyCesiumCode(code, { allowedSymbols: ["viewer"] });
    expect(result).toEqual({ verified: true });
  });

  it("exports the fixed safe global identifiers list and honors it", () => {
    expect(SAFE_GLOBAL_IDENTIFIERS).toContain("Math");
    expect(SAFE_GLOBAL_IDENTIFIERS).toContain("console");
    const code = `console.log(JSON.stringify({ a: Promise.resolve(1) }));`;
    const result = verifyCesiumCode(code, { allowedSymbols: [] });
    expect(result).toEqual({ verified: true });
  });
});

describe("verifyCesiumCode — unbounded loop heuristic", () => {
  it("rejects while(true) with no break", () => {
    const result = verifyCesiumCode(`while (true) { console.log("x"); }`, {
      allowedSymbols: ALLOWED,
    });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /unbounded/i.test(v))).toBe(true);
  });

  it("rejects for(;;) with no break", () => {
    const result = verifyCesiumCode(`for (;;) { console.log("x"); }`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
  });

  it("allows while(true) that has a break", () => {
    const code = `let x = 0; while (true) { x = x + 1; if (x > 3) break; }`;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });

  it("allows a bounded while loop with a real condition", () => {
    const code = `let x = 0; while (x < 10) { x = x + 1; }`;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED });
    expect(result).toEqual({ verified: true });
  });
});

describe("verifyCesiumCode — size limits", () => {
  it("rejects code exceeding maxLength", () => {
    const code = `const x = "${"a".repeat(50)}";`;
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED, maxLength: 10 });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /maximum length/i.test(v))).toBe(true);
  });

  it("rejects code exceeding maxLines", () => {
    const code = Array.from({ length: 20 }, (_, i) => `const x${i} = ${i};`).join("\n");
    const result = verifyCesiumCode(code, { allowedSymbols: ALLOWED, maxLines: 5 });
    expect(result.verified).toBe(false);
    expect(result.violations?.some((v) => /maximum line count/i.test(v))).toBe(true);
  });
});

describe("verifyCesiumCode — malformed input", () => {
  it("rejects a syntax error without throwing", () => {
    expect(() => verifyCesiumCode(`const x = ;;;`, { allowedSymbols: ALLOWED })).not.toThrow();
    const result = verifyCesiumCode(`const x = ;;;`, { allowedSymbols: ALLOWED });
    expect(result.verified).toBe(false);
    expect(result.violations && result.violations.length).toBeGreaterThan(0);
  });
});
