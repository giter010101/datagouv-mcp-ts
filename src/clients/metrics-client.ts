import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls, DatagouvApiEnv } from "../core/config.js";
import { UnsupportedCapabilityError, ValidationError } from "../core/errors.js";
import { buildUrl, type HttpClient } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import { metricsPageSchema } from "./schemas/metrics.js";
import type { MetricsClient, MetricsModel, MetricsRecord } from "./types.js";

export const METRICS_MAX_LIMIT = 50;
export const METRICS_DEFAULT_LIMIT = 12;
const METRICS_TTL_MS = 10 * 60_000;

export const METRICS_MODELS: readonly MetricsModel[] = [
  "datasets",
  "resources",
  "organizations",
  "reuses",
  "dataservices",
];

/** `datasets` → `dataset_id`, `dataservices` → `dataservice_id`… */
export function metricsIdField(model: MetricsModel): string {
  return `${model.replace(/s$/, "")}_id`;
}

export interface MetricsClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
  /** The Metrics API has no demo instance: `demo` is refused up-front (legacy guard). */
  apiEnv: DatagouvApiEnv;
}

export class HttpMetricsClient implements MetricsClient {
  private readonly log = childLogger("metrics-client");

  constructor(private readonly deps: MetricsClientDeps) {}

  async getMonthlyMetrics(
    model: MetricsModel,
    id: string,
    limit?: number,
  ): Promise<MetricsRecord[]> {
    if (this.deps.apiEnv !== "prod") {
      throw new UnsupportedCapabilityError(
        "The Metrics API is only available for the production environment (DATAGOUV_API_ENV=prod).",
        { details: { apiEnv: this.deps.apiEnv } },
      );
    }
    if (!METRICS_MODELS.includes(model)) {
      throw new ValidationError(`Unknown metrics model '${model}'.`, {
        details: { allowed: METRICS_MODELS },
      });
    }
    if (id.trim() === "") throw new ValidationError("A non-empty id is required for metrics.");
    const pageSize = Math.min(
      Math.max(1, Math.floor(limit ?? METRICS_DEFAULT_LIMIT)),
      METRICS_MAX_LIMIT,
    );
    const idField = metricsIdField(model);
    const url = buildUrl(this.deps.baseUrls.metricsApi, `${model}/data/`, {
      [`${idField}__exact`]: id,
      metric_month__sort: "desc",
      page_size: pageSize,
    });
    return this.deps.cache.getOrLoad(
      `metrics:${model}:${id}:${pageSize}`,
      async () => {
        this.log.debug({ url: url.href }, "metrics request");
        const body = await this.deps.http.getJson(url, { schema: metricsPageSchema });
        return body.data.map((row) => toMetricsRecord(row, idField));
      },
      { ttlMs: METRICS_TTL_MS },
    );
  }
}

const HIDDEN_KEYS = new Set(["__id", "metric_month"]);

/** Keep only numeric metric columns; `null` stays `null` (tools decide how to display it). */
export function toMetricsRecord(row: Record<string, unknown>, idField: string): MetricsRecord {
  const values: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (HIDDEN_KEYS.has(key) || key === idField || key.endsWith("_id")) continue;
    if (value === null) values[key] = null;
    else if (typeof value === "number") values[key] = value;
  }
  const month = row.metric_month;
  return { month: typeof month === "string" ? month : "", values };
}

export function createMetricsClient(deps: MetricsClientDeps): MetricsClient {
  return new HttpMetricsClient(deps);
}
