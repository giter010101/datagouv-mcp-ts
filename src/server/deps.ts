import { createDatagouvClient, type DatagouvSearchClient } from "../clients/datagouv-client.js";
import { type Cache, createCache } from "../core/cache.js";
import type { Config } from "../core/config.js";
import { createHttpClient, type FetchLike, type HttpClient } from "../core/http.js";
import { type AccessorRegistry, createAccessorRegistry } from "../formats/registry.js";
import type { ToolDeps } from "../tools/index.js";

/** Everything the server composes once at startup and hands to tools. */
export interface ServerDeps extends ToolDeps {
  config: Config;
  http: HttpClient;
  cache: Cache;
  datagouv: DatagouvSearchClient;
  formats: AccessorRegistry;
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
  const formats = createAccessorRegistry();
  return { config, http, cache, datagouv, formats };
}
