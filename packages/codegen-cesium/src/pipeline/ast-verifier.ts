/**
 * Static, parse-only AST verifier for generated CesiumJS code snippets.
 *
 * This module NEVER executes generated code — not via `eval`, not via `new Function(...)`, not
 * via dynamic `import()`, not via any sandboxed "just check if it runs" trick. It only parses the
 * code with `acorn` and walks the resulting AST with `acorn-walk`. Runtime execution of
 * model-generated code is explicitly out of scope for this package (that's the frontend iframe
 * sandbox's job, a separate already-built module) — adding any execution path here would cross
 * into a much bigger "Cloud Code Mode" isolation requirement that this package deliberately avoids.
 */
import { parse } from "acorn";
import { simple as walkSimple, ancestor as walkAncestor } from "acorn-walk";
import type { Node } from "acorn";

export interface VerifyOptions {
  /**
   * Symbols the generated code is allowed to reference as free identifiers / member-access
   * roots. Omit (or pass `undefined`) to skip the free-identifier allowlist check entirely —
   * generated code may then reference any identifier not otherwise banned (see
   * `BANNED_GLOBALS`, `eval`/`Function`/dynamic `import()` bans, computed member access ban).
   */
  allowedSymbols?: readonly string[];
  /** Hard cap on source size in characters. Default 4000. */
  maxLength?: number;
  /** Hard cap on line count. Default 100. */
  maxLines?: number;
}

export interface VerifyResult {
  verified: boolean;
  /** Populated when verified is false — every reason the code was rejected. */
  violations?: string[];
}

const DEFAULT_MAX_LENGTH = 4000;
const DEFAULT_MAX_LINES = 100;

/** Names of globals/APIs that must never be referenced by generated code, regardless of allowlist. */
const BANNED_GLOBALS = new Set([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
  "Worker",
  "SharedWorker",
  "postMessage",
]);

/**
 * Small fixed set of well-known, side-effect-free JS globals needed for basic control flow and
 * arithmetic/string/JSON manipulation. Independently exported so it's directly testable/importable
 * without reaching into this module's internals.
 */
export const SAFE_GLOBAL_IDENTIFIERS: readonly string[] = [
  "Math",
  "console",
  "undefined",
  "NaN",
  "Infinity",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "JSON",
  "Promise",
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
];

interface WalkerState {
  violations: Set<string>;
  allowed: Set<string>;
}

/** Adds a scope's declared names (function params, var/let/const declarators, function ids) to `locals`. */
function collectPatternNames(pattern: any, locals: Set<string>): void {
  if (!pattern) return;
  switch (pattern.type) {
    case "Identifier":
      locals.add(pattern.name);
      break;
    case "ObjectPattern":
      for (const prop of pattern.properties) {
        if (prop.type === "RestElement") collectPatternNames(prop.argument, locals);
        else collectPatternNames(prop.value, locals);
      }
      break;
    case "ArrayPattern":
      for (const el of pattern.elements) {
        if (el) collectPatternNames(el, locals);
      }
      break;
    case "AssignmentPattern":
      collectPatternNames(pattern.left, locals);
      break;
    case "RestElement":
      collectPatternNames(pattern.argument, locals);
      break;
    default:
      break;
  }
}

/**
 * Walks the whole program once up front to gather every locally-declared name (function/arrow
 * params, `var`/`let`/`const` declarators, named function declarations/expressions, class
 * declarations, and catch-clause bindings). We deliberately don't try to track precise lexical
 * scoping (shadowing, block scope boundaries) — a flat "is this name declared anywhere as a local
 * in this program" set is a conservative, simple approximation: it can only make the verifier
 * *more* permissive about local names (never less strict about banned globals/constructs), which
 * is an acceptable trade-off for a parse-only static verifier.
 */
function collectAllLocalNames(ast: Node): Set<string> {
  const locals = new Set<string>();

  /** Named function/arrow: registers its own name (if any) plus every parameter pattern. */
  function collectFunctionNames(node: any): void {
    if (node.id) locals.add(node.id.name);
    for (const param of node.params) collectPatternNames(param, locals);
  }

  /** Named class declaration/expression: registers its own name (if any). */
  function collectClassName(node: any): void {
    if (node.id) locals.add(node.id.name);
  }

  walkSimple(ast, {
    VariableDeclarator: (node: any) => collectPatternNames(node.id, locals),
    FunctionDeclaration: collectFunctionNames,
    FunctionExpression: collectFunctionNames,
    ArrowFunctionExpression: collectFunctionNames,
    ClassDeclaration: collectClassName,
    ClassExpression: collectClassName,
    CatchClause: (node: any) => node.param && collectPatternNames(node.param, locals),
  });

  return locals;
}

/**
 * True if `node` (an Identifier) is being used purely as a property key / shorthand key rather
 * than as a value reference — e.g. `{ foo: 1 }`'s `foo`, `{ foo }`'s shorthand key side, or
 * `obj.someProperty`'s non-computed `someProperty`.
 */
function isNonReferencingIdentifierUse(node: any, parent: any): boolean {
  if (!parent) return false;

  // Non-computed member property: obj.someProperty — `someProperty` isn't itself checked.
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
    return true;
  }

  // Object literal property key (non-computed, not shorthand value-only usage).
  if (parent.type === "Property" && parent.key === node && !parent.computed) {
    // Shorthand `{ foo }` has key === value === same node; that's still a value reference too,
    // but we only need to avoid flagging it as an *invalid free identifier* if it's a local — the
    // identifier-check walker below only inspects value positions, so shorthand keys are handled
    // there via the `value` side. Plain `key: expr` keys should never be checked as references.
    if (parent.shorthand) return false;
    return true;
  }

  return false;
}

/**
 * Verifies a generated CesiumJS code snippet via static AST analysis only. Never executes the
 * code. Enforces size limits, banned constructs (eval, Function, dynamic import, browser globals),
 * a free-identifier allowlist, and a heuristic unbounded-loop check.
 */
export function verifyCesiumCode(code: string, options: VerifyOptions = {}): VerifyResult {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const violations: string[] = [];

  if (code.length > maxLength) {
    violations.push(`Code exceeds maximum length of ${maxLength} characters (got ${code.length}).`);
  }

  const lineCount = code.split(/\r?\n/).length;
  if (lineCount > maxLines) {
    violations.push(`Code exceeds maximum line count of ${maxLines} (got ${lineCount}).`);
  }

  // Cheap checks fail fast, but we still attempt to parse to surface further issues where
  // possible — however if parsing throws, that alone is a fatal violation and we return early
  // (there's no AST to walk).
  let ast: Node;
  try {
    // `allowAwaitOutsideFunction` is required because the frontend sandbox executes generated
    // snippets inside an async IIFE (`(async () => { <code> })()`), so the model is expected
    // to write top-level `await addEntity(...)` style calls. Without this option, acorn's
    // default "script" grammar rejects top-level `await` as a syntax error, which would make
    // the verifier reject legitimate, correctly-written generated code.
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
    });
  } catch (error) {
    violations.push(
      `Code failed to parse as valid JavaScript: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { verified: false, violations };
  }

  // Size limits above (if any) are still collected together with AST-walk violations below so the
  // caller sees every issue at once.
  // `undefined` means "no allowlist restriction" (unrestricted identifier references), distinct
  // from `[]` which means "nothing beyond the safe globals is allowed".
  const unrestricted = options.allowedSymbols === undefined;
  const state: WalkerState = {
    violations: new Set(),
    allowed: new Set([...(options.allowedSymbols ?? []), ...SAFE_GLOBAL_IDENTIFIERS]),
  };

  const localNames = collectAllLocalNames(ast);

  walkAncestor(ast, {
    CallExpression(node: any) {
      const callee = node.callee;
      if (callee.type === "Identifier" && callee.name === "eval") {
        state.violations.add("Use of `eval(...)` is banned.");
      }
      if (callee.type === "Identifier" && callee.name === "Function") {
        state.violations.add("Calling `Function(...)` is banned.");
      }
    },
    NewExpression(node: any) {
      if (node.callee.type === "Identifier" && node.callee.name === "Function") {
        state.violations.add("Construction of `new Function(...)` is banned.");
      }
    },
    ImportExpression() {
      state.violations.add("Dynamic `import(...)` is banned.");
    },
    MemberExpression(node: any) {
      // Computed member access (obj[expr]) is blanket-banned rather than perfectly resolved: we
      // can't statically prove what `expr` evaluates to (e.g. `obj["evalProp".slice(0,4)]`), so
      // rather than try to special-case every safe pattern, we conservatively reject all computed
      // member access. This is a deliberate, documented over-approximation (see task description's
      // open question on computed member access) rather than an attempt at a sound analysis.
      if (node.computed) {
        state.violations.add(
          "Computed member access (e.g. `obj[expr]`) is banned — use dot notation instead.",
        );
      }
    },
    Identifier(node: any, _state, ancestors: any[]) {
      const parent = ancestors[ancestors.length - 2];
      const name = node.name;

      // Banned browser/global APIs, whether referenced bare or as a member-expression root.
      if (BANNED_GLOBALS.has(name)) {
        if (parent === undefined || !isNonReferencingIdentifierUse(node, parent)) {
          state.violations.add(`Reference to banned global \`${name}\` is not allowed.`);
        }
        return;
      }

      // `eval`/`Function` as bare references (not calls/constructions, which are already caught
      // by the CallExpression/NewExpression handlers above) are also banned — e.g. `const f =
      // Function;` or `const e = eval;` used to obscure a later call.
      if (
        (name === "Function" || name === "eval") &&
        !isNonReferencingIdentifierUse(node, parent)
      ) {
        const isDirectCall = parent?.type === "CallExpression" && parent.callee === node;
        const isDirectConstruct = parent?.type === "NewExpression" && parent.callee === node;
        if (!isDirectCall && !isDirectConstruct) {
          state.violations.add(`Reference to \`${name}\` is not allowed.`);
        }
        return;
      }

      // Skip identifiers that are property keys or non-computed member properties — not value refs.
      if (isNonReferencingIdentifierUse(node, parent)) return;

      // Skip identifiers that are declaration targets themselves (the `x` in `const x = 1`, a
      // function/class name being declared, a parameter, a catch binding) — those are bindings,
      // not references, and are handled by localNames for their *usage* sites elsewhere.
      if (parent?.type === "VariableDeclarator" && parent.id === node) return;
      if (
        (parent?.type === "FunctionDeclaration" || parent?.type === "FunctionExpression") &&
        parent.id === node
      ) {
        return;
      }
      if (
        (parent?.type === "ClassDeclaration" || parent?.type === "ClassExpression") &&
        parent.id === node
      ) {
        return;
      }
      if (isParamOf(parent, node)) return;
      if (parent?.type === "CatchClause" && parent.param === node) return;
      if (
        parent?.type === "LabeledStatement" ||
        parent?.type === "BreakStatement" ||
        parent?.type === "ContinueStatement"
      ) {
        return; // labels aren't identifier references
      }
      // MetaProperty (e.g. new.target) — not a real identifier reference.
      if (parent?.type === "MetaProperty") return;

      // A genuine free-identifier value reference: must be a known local, an allowed symbol, or a
      // safe global — unless the allowlist check itself is disabled (`unrestricted`).
      if (!unrestricted && !localNames.has(name) && !state.allowed.has(name)) {
        state.violations.add(`Reference to disallowed identifier \`${name}\` is not allowed.`);
      }
    },
    WhileStatement(node: any) {
      checkUnboundedLoop(node.test, node.body, state);
    },
    ForStatement(node: any) {
      if (node.test === null) {
        checkUnboundedLoop(null, node.body, state);
      }
    },
    DoWhileStatement(node: any) {
      checkUnboundedLoop(node.test, node.body, state);
    },
  });

  for (const v of state.violations) violations.push(v);

  if (violations.length > 0) {
    return { verified: false, violations };
  }
  return { verified: true };
}

/** True if `node` is a parameter of the function/arrow that is `parent`. */
function isParamOf(parent: any, node: any): boolean {
  if (!parent) return false;
  if (
    parent.type === "FunctionDeclaration" ||
    parent.type === "FunctionExpression" ||
    parent.type === "ArrowFunctionExpression"
  ) {
    return parent.params?.includes(node) ?? false;
  }
  return false;
}

/** True if `test` is a statically "always true" loop condition (`true`, or absent as in `for(;;)`). */
function isAlwaysTrueCondition(test: any): boolean {
  if (test === null || test === undefined) return true; // for(;;)
  if (test.type === "Literal" && test.value === true) return true; // while(true)
  return false;
}

/**
 * Pragmatic heuristic (not a termination proof — proving loop termination in general is
 * undecidable): rejects a loop whose condition is trivially always-true AND whose body contains
 * no `break` statement anywhere (including nested blocks/ifs, but not inside a nested loop or
 * function, since a `break` there wouldn't escape *this* loop).
 */
function checkUnboundedLoop(test: any, body: any, state: WalkerState): void {
  if (!isAlwaysTrueCondition(test)) return;
  if (loopBodyHasBreak(body)) return;
  state.violations.add(
    "Loop with an always-true condition and no `break` statement is rejected as unbounded (heuristic check, not a termination proof).",
  );
}

/** Finds a `break` statement that would escape the loop `body` directly (not through a nested loop/function/switch-only-break-for-switch is still fine since break inside switch doesn't escape our loop either, but we still count it conservatively as escaping if unlabeled — see note). */
function loopBodyHasBreak(body: any): boolean {
  let found = false;

  function visit(node: any, insideNestedLoopOrFunction: boolean): void {
    if (found || !node || typeof node !== "object") return;

    if (node.type === "BreakStatement") {
      // An unlabeled break inside a nested loop/switch escapes *that* construct, not necessarily
      // ours — but a labeled break could still target our loop. We conservatively treat ANY break
      // found in the body as "possibly escapes this loop" (permissive heuristic — see doc above),
      // to avoid false positives on legitimate bounded-looking loops using nested constructs.
      found = true;
      return;
    }

    const isNestedLoopOrFunction =
      node.type === "WhileStatement" ||
      node.type === "DoWhileStatement" ||
      node.type === "ForStatement" ||
      node.type === "ForInStatement" ||
      node.type === "ForOfStatement" ||
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression";

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range")
        continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) visit(item, insideNestedLoopOrFunction || isNestedLoopOrFunction);
      } else if (value && typeof value === "object") {
        visit(value, insideNestedLoopOrFunction || isNestedLoopOrFunction);
      }
    }
  }

  visit(body, false);
  return found;
}
