import { createDatagouvClient } from "../clients/datagouv-client.js";
import type {
  CrawlerClient,
  DatagouvClient,
  MetricsClient,
  SchemaClient,
  TabularClient,
} from "../clients/types.js";
import { type Cache, createCache } from "../core/cache.js";
import type { Config } from "../core/config.js";
import { NotFoundError } from "../core/errors.js";
import { createHttpClient, type FetchLike, type HttpClient } from "../core/http.js";
import { defaultAccessors } from "../formats/accessors/index.js";
import { createCapabilityDetector } from "../formats/capability.js";
import { fetchHead } from "../formats/download.js";
import { createEngines } from "../formats/engines/index.js";
import { createAccessorRegistry } from "../formats/registry.js";
import type {
  FormatsDeps as FormatsTypesDeps,
  QueryEngine,
  TabularDataSource,
} from "../formats/types.js";
import type { FormatsDeps as ToolFormatsDeps } from "../tools/deps.js";
import type { ToolDeps } from "../tools/index.js";

/** Everything the server composes once at startup and hands to tools. */
export interface ServerDeps extends ToolDeps {
  config: Config;
  http: HttpClient;
  cache: Cache;
  datagouv: DatagouvClient;
}

export interface CreateDepsOptions {
  /** Injected in tests to avoid network access. */
  fetchImpl?: FetchLike;
}

export function createDeps(config: Config, options: CreateDepsOptions = {}): ServerDeps {
  const http = createHttpClient({
    timeoutMs: config.http.timeoutMs,
    retries: config.http.retries,
    fetchImpl: options.fetchImpl,
  });
  const cache = createCache({
    maxEntries: config.cache.maxEntries,
    defaultTtlMs: config.cache.defaultTtlMs,
  });
  const datagouv = createDatagouvClient({ http, cache, baseUrls: config.baseUrls });
  // Work-in-progress: formats/tools require more clients (tabular, metrics, crawler,
  // schema). Until workstream B completes, we provide safe stubs so the server
  // compiles and the currently-registered tool(s) keep working.
  const tabular: TabularClient = {
    async getResourceMeta() {
      return undefined;
    },
    async isAvailable() {
      return false;
    },
    async getProfile() {
      return undefined;
    },
    async queryData() {
      return { rows: [], page: 1, pageSize: 1, total: 0, nextUrl: undefined };
    },
    async aggregate() {
      return { rows: [], page: 1, pageSize: 1, total: 0, nextUrl: undefined };
    },
    async isAggregationAllowed() {
      return false;
    },
    async getSwagger() {
      return { columns: [], raw: {} };
    },
  };

  const tabularDataSource: TabularDataSource = {
    getProfile: (resourceId) => tabular.getProfile(resourceId),
    queryData: (resourceId, query) =>
      tabular
        .queryData(resourceId, {
          page: query.page,
          pageSize: query.pageSize,
          filters: query.filters,
          sort: query.sort,
          columns: query.columns,
        })
        .then((page) => ({
          rows: page.rows,
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
        })),
    isAggregationAllowed: (resourceId) => tabular.isAggregationAllowed(resourceId),
    aggregate: (resourceId, query) =>
      tabular.aggregate(resourceId, {
        groupBy: query.groupBy,
        metrics: query.metrics.map((m) => ({
          column: m.column ?? query.groupBy[0] ?? "id",
          fn: m.op,
        })),
        filters: query.filters,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize,
      }),
  };

  const metrics: MetricsClient = {
    async getMonthlyMetrics() {
      return [];
    },
  };

  const crawler: CrawlerClient = {
    async getResourceExceptions() {
      return new Set();
    },
    async isException() {
      return false;
    },
    async getHealth() {
      return { version: undefined, environment: undefined, features: {} };
    },
  };

  const schema: SchemaClient = {
    async listSchemas() {
      return [];
    },
    async getSchema() {
      throw new NotFoundError("Schema not available (stub).", { details: {} });
    },
    async validateResource() {
      return {
        valid: false,
        errorCount: 0,
        warningCount: 0,
        rows: undefined,
        errors: [],
        warnings: [],
      };
    },
  };

  const engines = createEngines({
    http,
    maxDownloadBytes: config.http.maxDownloadBytes,
    enableDuckdb: config.engines.duckdb,
  });

  // Capability detector builds Tabular API probe URLs as:
  // `${tabularApiBaseUrl}/api/resources/{rid}/`, so tabularApiBaseUrl must not include `/api`.
  const tabularApiBaseUrl = config.baseUrls.tabularApi.replace(/\/api\/?$/i, "");

  const formatsTypesDeps: FormatsTypesDeps = {
    http,
    tabular: tabularDataSource,
    crawlerExceptions: () => crawler.getResourceExceptions(),
    tabularApiBaseUrl,
    maxDownloadBytes: config.http.maxDownloadBytes,
    engines,
    logger: undefined,
  };

  const registry = createAccessorRegistry(defaultAccessors(formatsTypesDeps));

  const detectCapability = createCapabilityDetector({
    probeTabular: async (resourceId) => formatsTypesDeps.tabular?.getProfile(resourceId),
    crawlerExceptions: formatsTypesDeps.crawlerExceptions ?? (async () => new Set()),
    tabularApiBaseUrl: formatsTypesDeps.tabularApiBaseUrl,
    maxDownloadBytes: formatsTypesDeps.maxDownloadBytes,
    sniffHead: (url, bytes) => fetchHead(http, url, bytes),
  });

  const engine: QueryEngine | undefined = engines.duckdb;
  const formats: ToolFormatsDeps = { registry, detectCapability, engine };

  return { config, http, cache, datagouv, tabular, metrics, crawler, schema, formats };
}
