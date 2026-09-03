import type { Cache } from "../core/cache.js";
import type { Config } from "../core/config.js";
import type { HttpClient } from "../core/http.js";
import { createCrawlerClient } from "./crawler-client.js";
import { createDatagouvClient } from "./datagouv-client.js";
import { createMetricsClient } from "./metrics-client.js";
import { createSchemaClient } from "./schema-client.js";
import { createTabularClient } from "./tabular-client.js";
import type { Clients } from "./types.js";

export * from "./crawler-client.js";
export * from "./datagouv-client.js";
export * from "./datagouv-reference.js";
export { extractAnalysis } from "./mappers/dataset.js";
export * from "./metrics-client.js";
export * from "./openapi.js";
export * from "./schema-client.js";
export * from "./tabular-client.js";
export * from "./types.js";

export interface CreateClientsDeps {
  http: HttpClient;
  cache: Cache;
}

/**
 * Build the full `Clients` bundle from the process-wide `HttpClient` and `Cache`.
 * `server/deps.ts` calls this once; tests pass a mocked `http`.
 */
export function createClients(
  config: Pick<Config, "baseUrls" | "datagouvApiEnv">,
  deps: CreateClientsDeps,
): Clients {
  const shared = { http: deps.http, cache: deps.cache, baseUrls: config.baseUrls };
  return {
    datagouv: createDatagouvClient(shared),
    tabular: createTabularClient(shared),
    metrics: createMetricsClient({ ...shared, apiEnv: config.datagouvApiEnv }),
    crawler: createCrawlerClient(shared),
    schema: createSchemaClient(shared),
  };
}
