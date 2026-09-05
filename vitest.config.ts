import { defineConfig } from "vitest/config";

/**
 * Test projects (workstream D, ADR 0010):
 *
 * | project   | what                                            | network | how to run                                   |
 * |-----------|-------------------------------------------------|---------|----------------------------------------------|
 * | `offline` | unit + contract + e2e (+ helper self-tests)     | blocked | `pnpm test` (default; must finish in < 10 s) |
 * | `live`    | real server over stdio against data.gouv.fr     | yes     | `pnpm test:live`  (`DATAGOUV_LIVE=1`)        |
 * | `stress`  | concurrency / abrupt-disconnect run on HTTP     | yes     | `pnpm test:stress` (`DATAGOUV_STRESS=1`)     |
 *
 * `live` / `stress` are only registered when their env flag is set so a plain
 * `vitest run` never touches the network. `RUN_LIVE_TESTS=1` is accepted as a
 * legacy alias of `DATAGOUV_LIVE=1`.
 */

const LIVE = process.env.DATAGOUV_LIVE === "1" || process.env.RUN_LIVE_TESTS === "1";
const STRESS = process.env.DATAGOUV_STRESS === "1";

const sharedEnv = { LOG_LEVEL: process.env.LOG_LEVEL ?? "silent" };

/**
 * Coverage gates (v8, lines/statements/functions/branches).
 *
 * ADR 0010 targets ≥ 90 % for core/clients/formats. These floors are the
 * 2026-09-03 measured offline coverage minus a 5-point buffer so CI stays
 * green while contract/e2e suites grow — raise them after `pnpm test:coverage`
 * (see `.agent/tech-debt/TD-009-coverage-thresholds.md`).
 *
 * Measured 2026-09-03 (after 21-tool offline e2e):
 *   clients  lines 60.81 / funcs 63.58 / branches 35.62 / stmts 57.44
 *   formats  lines 63.73 / funcs 64.39 / branches 53.67 / stmts 60.62
 *   tools    lines 76.04 / funcs 75.81 / branches 45.85 / stmts 74.27
 *   server   lines 78.94 / funcs 69.23 (stmts/branches already ≥ 70)
 *   core     already above the original 80/80/70/80 floors
 */
export const COVERAGE_THRESHOLDS = {
  "src/core/**/*.ts": { lines: 80, functions: 80, branches: 70, statements: 80 },
  "src/clients/**/*.ts": { lines: 55, functions: 58, branches: 30, statements: 52 },
  "src/formats/**/*.ts": { lines: 58, functions: 59, branches: 48, statements: 55 },
  "src/tools/**/*.ts": { lines: 71, functions: 70, branches: 40, statements: 69 },
  "src/server/**/*.ts": { lines: 70, functions: 64, branches: 55, statements: 70 },
} as const;

export default defineConfig({
  test: {
    environment: "node",
    env: sharedEnv,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/**/types.ts"],
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: { ...COVERAGE_THRESHOLDS },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "offline",
          include: [
            "src/**/*.test.ts",
            "tests/unit/**/*.test.ts",
            "tests/contract/**/*.test.ts",
            "tests/e2e/**/*.test.ts",
            "tests/helpers/**/*.test.ts",
          ],
          exclude: ["node_modules", "dist", "legacy", "tests/live/**", "tests/stress/**"],
          setupFiles: ["tests/setup.ts"],
          testTimeout: 10_000,
          hookTimeout: 10_000,
        },
      },
      ...(LIVE
        ? [
            {
              extends: true as const,
              test: {
                name: "live",
                include: ["tests/live/**/*.test.ts"],
                exclude: ["node_modules", "dist", "legacy"],
                env: { ...sharedEnv, DATAGOUV_LIVE: "1" },
                testTimeout: 60_000,
                hookTimeout: 60_000,
                retry: 2,
                // Be nice to the upstream API: one worker at a time.
                fileParallelism: false,
              },
            },
          ]
        : []),
      ...(STRESS
        ? [
            {
              extends: true as const,
              test: {
                name: "stress",
                include: ["tests/stress/**/*.test.ts"],
                exclude: ["node_modules", "dist", "legacy"],
                env: { ...sharedEnv, DATAGOUV_STRESS: "1" },
                testTimeout: 180_000,
                hookTimeout: 60_000,
                fileParallelism: false,
              },
            },
          ]
        : []),
    ],
  },
});
