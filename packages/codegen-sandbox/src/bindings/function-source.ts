/**
 * Shared helper for authoring guest-side (QuickJS-evaluated) JS as real, type-checked TypeScript
 * functions instead of template-literal strings.
 *
 * Every `guest-prelude-*.ts` builder needs to produce plain JS *source
 * text* — it's concatenated with the other builders' output and evaluated as one script inside the
 * QuickJS guest (see `cesium-code-sandbox.ts`), never executed directly in the host. Writing that
 * text as a template literal works, but loses real syntax highlighting/formatting and — since
 * template-literal contents are opaque to the compiler — any type-checking of typos, wrong
 * identifier names, or wrong argument counts.
 *
 * Instead, each builder declares an ordinary (never-called) function containing the real guest
 * logic, and calls `extractFunctionBody` to recover its exact source text via
 * `Function.prototype.toString()` (guaranteed by spec to return the original source, not a
 * re-serialization) — the wrapper function itself is discarded, only its body text is used. Guest
 * globals the body references that don't exist in the TypeScript compilation context (e.g.
 * `__cesiumSandboxHostGetSync__`, `__CesiumCoreBundle__`) must be declared with `declare const`/`declare
 * function` at the top of the same file so the compiler can still check the body — those
 * declarations are erased at compile time and never appear in the extracted text.
 */
export function extractFunctionBody(fn: (...args: never[]) => unknown): string {
  const text = fn.toString();
  return text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
}
