import { defineConfig } from "vitest/config";

const runLive = process.env.RUN_LIVE_TESTS === "1";

export default defineConfig({
  test: {
    environment: "node",
    // Keep test output readable; set LOG_LEVEL=debug on the command line to see server logs.
    env: { LOG_LEVEL: process.env.LOG_LEVEL ?? "silent" },
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "legacy", ...(runLive ? [] : ["tests/live/**"])],
    testTimeout: runLive ? 30_000 : 10_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
