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
 * Coverage gates (v8, lines/statements/functions/branches). Starting values are
 * deliberately below the ADR 0010 targets (≥ 90 % for core/clients/formats) so
 * the gate is green while A/B/C land; raise them in `vitest.config.ts` as the
 * suites grow (run `pnpm test:coverage` to see current numbers).
 */
export const COVERAGE_THRESHOLDS = {
  "src/core/**/*.ts": { lines: 80, functions: 80, branches: 70, statements: 80 },
  "src/clients/**/*.ts": { lines: 75, functions: 75, branches: 60, statements: 75 },
  "src/formats/**/*.ts": { lines: 70, functions: 70, branches: 55, statements: 70 },
  "src/tools/**/*.ts": { lines: 80, functions: 80, branches: 65, statements: 80 },
  "src/server/**/*.ts": { lines: 70, functions: 70, branches: 55, statements: 70 },
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
