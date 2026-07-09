import { defineConfig } from "vitest/config";

/**
 * Unit + HTTP API tests, run with Vitest in a Node environment.
 *
 * These complement the Playwright `e2e/` suite (browser, frontend-only): they
 * cover the backend↔frontend chat pipeline the e2e specs deliberately stub —
 * the Express chat router and rate limiter (driven over real HTTP), the
 * provider-selection logic, and the streaming chat client.
 *
 * Test files are colocated with their source as `*.test.ts`; the `e2e/`
 * Playwright specs use `*.spec.ts`, so the two runners never pick up each
 * other's files.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "shared/src/**/*.test.ts",
      "frontend/src/**/*.test.ts",
      "backend/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
