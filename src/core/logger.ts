import { destination, type Logger, pino } from "pino";
import { type LogLevel, normalizeLogLevel } from "./config.js";

export type { Logger };

/**
 * Root pino logger. Always writes to **stderr**: stdout is reserved for the
 * stdio MCP transport and must never receive log lines. The level is read from
 * `LOG_LEVEL` at import time and refined by `setLogLevel` once config is loaded.
 */
export const rootLogger: Logger = pino(
  {
    name: "datagouv-mcp",
    level: normalizeLogLevel(process.env.LOG_LEVEL) ?? "info",
    base: undefined,
    redact: {
      paths: ["*.authorization", "*.MATOMO_AUTH_TOKEN", "*.SENTRY_DSN", "headers.authorization"],
      censor: "[REDACTED]",
    },
  },
  destination({ fd: 2, sync: false }),
);

export function setLogLevel(level: LogLevel): void {
  rootLogger.level = level;
}

/** Per-module child logger: `const log = childLogger("datagouv-client")`. */
export function childLogger(module: string, bindings: Record<string, unknown> = {}): Logger {
  return rootLogger.child({ module, ...bindings });
}
