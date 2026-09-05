import { z } from "zod";
import { ConfigError } from "./errors.js";

/**
 * Runtime configuration, parsed once from environment variables.
 *
 * Variable names stay compatible with the legacy Python server
 * (`MCP_HOST`, `MCP_PORT`, `MCP_ENV`, `DATAGOUV_API_ENV`, `LOG_LEVEL`, `MATOMO_*`, `SENTRY_*`).
 */

export const DATAGOUV_API_ENVS = ["prod", "demo"] as const;
export type DatagouvApiEnv = (typeof DATAGOUV_API_ENVS)[number];

export const TRANSPORTS = ["stdio", "http"] as const;
export type TransportKind = (typeof TRANSPORTS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Legacy Python accepted uppercase Python levels; map them to pino levels. */
const LEGACY_LOG_LEVELS: Record<string, LogLevel> = {
  CRITICAL: "fatal",
  ERROR: "error",
  WARNING: "warn",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
  NOTSET: "trace",
};

/** Accepts pino levels (any case) and legacy uppercase Python levels; `undefined` when invalid. */
export function normalizeLogLevel(raw: string | undefined): LogLevel | undefined {
  if (raw === undefined || raw.trim() === "") return "info";
  const value = raw.trim();
  const legacy = LEGACY_LOG_LEVELS[value.toUpperCase()];
  if (legacy && value === value.toUpperCase()) return legacy;
  const lower = value.toLowerCase();
  return LOG_LEVELS.includes(lower as LogLevel) ? (lower as LogLevel) : undefined;
}

export const DEFAULT_ALLOWED_HOSTS = [
  "mcp.data.gouv.fr",
  "mcp.preprod.data.gouv.fr",
  "localhost",
  "127.0.0.1",
  "[::1]",
];

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://mcp.data.gouv.fr",
  "https://mcp.preprod.data.gouv.fr",
  "http://localhost",
  "http://127.0.0.1",
];

function splitList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value.trim() === "") return fallback;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) =>
    v === undefined ? false : ["1", "true", "yes", "on"].includes(v.toLowerCase()),
  );

const intFromEnv = (fallback: number, min: number, max?: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === "") return fallback;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
        ctx.addIssue({ code: "custom", message: `expected integer in [${min}, ${max ?? "∞"}]` });
        return z.NEVER;
      }
      return n;
    });

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

export const configSchema = z.object({
  MCP_TRANSPORT: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const value = (v ?? "stdio").toLowerCase();
      if (!TRANSPORTS.includes(value as TransportKind)) {
        ctx.addIssue({ code: "custom", message: `expected one of ${TRANSPORTS.join(", ")}` });
        return z.NEVER;
      }
      return value as TransportKind;
    }),
  MCP_HOST: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : "127.0.0.1")),
  MCP_PORT: intFromEnv(8000, 1, 65535),
  MCP_ENV: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : "local")),
  /** Comma-separated hostnames accepted in the Host header (DNS rebinding protection). */
  MCP_ALLOWED_HOSTS: z
    .string()
    .optional()
    .transform((v) => splitList(v, DEFAULT_ALLOWED_HOSTS)),
  /** Comma-separated origins accepted in the Origin header (`*` disables the check). */
  MCP_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) => splitList(v, DEFAULT_ALLOWED_ORIGINS)),
  DATAGOUV_API_ENV: z
    .string()
    .optional()
    .transform((v): DatagouvApiEnv => {
      const value = (v ?? "prod").toLowerCase();
      // Legacy behaviour: unknown values silently fall back to prod.
      return DATAGOUV_API_ENVS.includes(value as DatagouvApiEnv)
        ? (value as DatagouvApiEnv)
        : "prod";
    }),
  LOG_LEVEL: z
    .string()
    .optional()
    .transform((v, ctx): LogLevel => {
      const level = normalizeLogLevel(v);
      if (level !== undefined) return level;
      ctx.addIssue({ code: "custom", message: `expected one of ${LOG_LEVELS.join(", ")}` });
      return z.NEVER;
    }),
  HTTP_TIMEOUT_MS: intFromEnv(15_000, 100),
  HTTP_RETRIES: intFromEnv(2, 0, 10),
  MAX_DOWNLOAD_BYTES: intFromEnv(50 * 1024 * 1024, 1024),
  CACHE_MAX_ENTRIES: intFromEnv(500, 0),
  CACHE_DEFAULT_TTL_MS: intFromEnv(5 * 60_000, 0),
  MAX_OUTPUT_CHARS: intFromEnv(40_000, 1_000),
  ENABLE_DUCKDB: boolFromEnv,
  MATOMO_URL: optionalString,
  MATOMO_SITE_ID: optionalString,
  MATOMO_AUTH_TOKEN: optionalString,
  SENTRY_DSN: optionalString,
  SENTRY_SAMPLE_RATE: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === "") return 1;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        ctx.addIssue({ code: "custom", message: "expected a number between 0 and 1" });
        return z.NEVER;
      }
      return n;
    }),
});

export interface ApiBaseUrls {
  /** udata API root, e.g. `https://www.data.gouv.fr/api/` (append `1/` or `2/`). */
  datagouvApi: string;
  /** Public web site root, used to build human-readable URLs. */
  site: string;
  tabularApi: string;
  /** Metrics API has no demo instance: always production. */
  metricsApi: string;
  crawlerApi: string;
  /** schema.data.gouv.fr catalogue root. */
  schemaCatalog: string;
  /** Validata validation API root. */
  validataApi: string;
}

const BASE_URLS: Record<DatagouvApiEnv, ApiBaseUrls> = {
  prod: {
    datagouvApi: "https://www.data.gouv.fr/api/",
    site: "https://www.data.gouv.fr/",
    tabularApi: "https://tabular-api.data.gouv.fr/api/",
    metricsApi: "https://metric-api.data.gouv.fr/api/",
    crawlerApi: "https://crawler.data.gouv.fr/api/",
    schemaCatalog: "https://schema.data.gouv.fr/",
    validataApi: "https://api.validata.etalab.studio/",
  },
  demo: {
    datagouvApi: "https://demo.data.gouv.fr/api/",
    site: "https://demo.data.gouv.fr/",
    tabularApi: "https://tabular-api.preprod.data.gouv.fr/api/",
    metricsApi: "https://metric-api.data.gouv.fr/api/",
    crawlerApi: "https://demo-crawler.data.gouv.fr/api/",
    schemaCatalog: "https://schema.data.gouv.fr/",
    validataApi: "https://api.validata.etalab.studio/",
  },
};

export function resolveBaseUrls(env: DatagouvApiEnv): ApiBaseUrls {
  return BASE_URLS[env];
}

export interface Config {
  transport: TransportKind;
  host: string;
  port: number;
  mcpEnv: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  datagouvApiEnv: DatagouvApiEnv;
  baseUrls: ApiBaseUrls;
  logLevel: LogLevel;
  http: { timeoutMs: number; retries: number; maxDownloadBytes: number };
  cache: { maxEntries: number; defaultTtlMs: number };
  output: { maxChars: number };
  engines: { duckdb: boolean };
  matomo: { url: string; siteId: string; authToken: string | undefined } | undefined;
  sentry: { dsn: string; sampleRate: number } | undefined;
}

export type EnvSource = Record<string, string | undefined>;

/** Parse configuration from an env-like record. Throws `ConfigError` with all issues listed. */
export function loadConfig(env: EnvSource = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new ConfigError(`Invalid configuration: ${issues}`, {
      details: { issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
    });
  }
  const c = parsed.data;
  return {
    transport: c.MCP_TRANSPORT,
    host: c.MCP_HOST,
    port: c.MCP_PORT,
    mcpEnv: c.MCP_ENV,
    allowedHosts: c.MCP_ALLOWED_HOSTS,
    allowedOrigins: c.MCP_ALLOWED_ORIGINS,
    datagouvApiEnv: c.DATAGOUV_API_ENV,
    baseUrls: resolveBaseUrls(c.DATAGOUV_API_ENV),
    logLevel: c.LOG_LEVEL,
    http: {
      timeoutMs: c.HTTP_TIMEOUT_MS,
      retries: c.HTTP_RETRIES,
      maxDownloadBytes: c.MAX_DOWNLOAD_BYTES,
    },
    cache: { maxEntries: c.CACHE_MAX_ENTRIES, defaultTtlMs: c.CACHE_DEFAULT_TTL_MS },
    output: { maxChars: c.MAX_OUTPUT_CHARS },
    engines: { duckdb: c.ENABLE_DUCKDB },
    matomo:
      c.MATOMO_URL !== undefined && c.MATOMO_SITE_ID !== undefined
        ? { url: c.MATOMO_URL, siteId: c.MATOMO_SITE_ID, authToken: c.MATOMO_AUTH_TOKEN }
        : undefined,
    sentry:
      c.SENTRY_DSN !== undefined
        ? { dsn: c.SENTRY_DSN, sampleRate: c.SENTRY_SAMPLE_RATE }
        : undefined,
  };
}
