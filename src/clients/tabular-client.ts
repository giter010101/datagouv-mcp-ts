import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import {
  ApiError,
  type DatagouvError,
  isDatagouvError,
  NotFoundError,
  UnsupportedCapabilityError,
  ValidationError,
} from "../core/errors.js";
import { buildUrl, type HttpClient, type QueryParams } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import type { ColumnSchema, ColumnType, Row, TableSchema } from "../core/types.js";
import { parseOpenApiDocument } from "./openapi.js";
import {
  type TabularProfileResponse,
  tabularAggregationExceptionsSchema,
  tabularDataPageSchema,
  tabularErrorBodySchema,
  tabularProfileSchema,
  tabularResourceMetaSchema,
} from "./schemas/tabular.js";
import type {
  TabularAggregation,
  TabularClient,
  TabularFilter,
  TabularPage,
  TabularQuery,
  TabularResourceMeta,
  TabularSort,
  TabularSwagger,
} from "./types.js";

export const TABULAR_MAX_PAGE_SIZE = 200;
export const TABULAR_DEFAULT_PAGE_SIZE = 20;
const PROFILE_TTL_MS = 10 * 60_000;
const DATA_TTL_MS = 60_000;
const EXCEPTIONS_TTL_MS = 60 * 60_000;

/** LLM-facing messages (legacy `tabular_api_client` wording preserved where it existed). */
export const TABULAR_MESSAGES = {
  notInTabular:
    "This resource is not available in the Tabular API. Only CSV/XLSX files parsed by data.gouv.fr are queryable this way. Use search_datasets → list_dataset_resources to find a queryable resource, or download the file from its URL.",
  serverIssue:
    "The Tabular API is temporarily unavailable or overloaded. Retry in a moment with a smaller page_size or fewer filters.",
  badRequest:
    "The Tabular API rejected the query. Check filter column names (case-sensitive, see get_resource_schema), operators and sort parameters.",
  columnHint:
    " Column names must match the resource header exactly; call get_resource_schema to list them.",
} as const;

export interface TabularClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

/** csv-detective `python_type` → normalised column type. */
const PYTHON_TYPES: Record<string, ColumnType> = {
  string: "string",
  str: "string",
  int: "integer",
  integer: "integer",
  float: "number",
  number: "number",
  bool: "boolean",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  json: "json",
  geojson: "geometry",
};

export function toColumnType(
  pythonType: string | null | undefined,
  format: string | null | undefined,
): ColumnType {
  if (format && /geo|wkt|latlon/i.test(format)) return "geometry";
  if (format === "json" || format === "geojson") return format === "json" ? "json" : "geometry";
  if (format === "date" || format === "datetime") return format;
  if (!pythonType) return "unknown";
  return PYTHON_TYPES[pythonType.toLowerCase()] ?? "unknown";
}

/** Legacy behaviour: strip surrounding quotes some producers keep in header names. */
const cleanHeader = (name: string): string => name.replace(/^"+|"+$/g, "");

export function profileToTableSchema(body: TabularProfileResponse): TableSchema {
  const profile = body.profile ?? {};
  const info = profile.columns ?? {};
  const stats = profile.profile ?? {};
  const header = profile.header ?? Object.keys(info);
  const columns: ColumnSchema[] = header.map((rawName) => {
    const name = cleanHeader(rawName);
    const col = info[rawName] ?? info[name];
    const colStats = stats[rawName] ?? stats[name];
    const missing = colStats?.nb_missing_values;
    return {
      name,
      type: toColumnType(col?.python_type, col?.format),
      nativeType: col?.format ?? col?.python_type ?? undefined,
      nullable: typeof missing === "number" ? missing > 0 : undefined,
      stats: colStats,
    };
  });
  return { columns, rowCount: profile.total_lines ?? undefined, source: "tabular-api" };
}

export function buildTabularQuery(
  filters: TabularFilter[] | undefined,
  sort: TabularSort[] | undefined,
  page: number,
  pageSize: number,
): QueryParams {
  const query: QueryParams = { page, page_size: pageSize };
  for (const f of filters ?? []) query[`${f.column}__${f.operator}`] = f.value;
  for (const s of sort ?? []) query[`${s.column}__sort`] = s.direction;
  return query;
}

export function projectRows(rows: Row[], columns: string[] | undefined): Row[] {
  if (!columns || columns.length === 0) return rows;
  const wanted = new Set(columns);
  return rows.map((row) => {
    const out: Row = {};
    for (const key of Object.keys(row)) if (wanted.has(key)) out[key] = row[key];
    return out;
  });
}

/** Map HTTP failures of the Tabular API to LLM-friendly errors. */
export function mapTabularError(error: unknown, resourceId: string): DatagouvError {
  if (error instanceof NotFoundError) {
    return new NotFoundError(TABULAR_MESSAGES.notInTabular, {
      details: { resourceId },
      hint: "Call get_resource_info to see which access paths this resource supports.",
    });
  }
  if (error instanceof ApiError) {
    if (error.status >= 500 || error.status === 408) {
      return new ApiError(TABULAR_MESSAGES.serverIssue, {
        status: error.status,
        url: error.url,
        cause: error,
        details: { resourceId },
      });
    }
    if (error.status >= 400) {
      const detail = extractTabularErrorDetail(error.details?.body);
      const hint = detail && /does not exist/i.test(detail) ? TABULAR_MESSAGES.columnHint : "";
      return new ValidationError(
        `${TABULAR_MESSAGES.badRequest}${detail ? ` Upstream said: ${detail}.` : ""}${hint}`,
        { cause: error, details: { resourceId, status: error.status, upstreamDetail: detail } },
      );
    }
  }
  if (isDatagouvError(error)) return error;
  return new ApiError(TABULAR_MESSAGES.serverIssue, {
    status: 0,
    url: "",
    cause: error,
    details: { resourceId },
  });
}

function extractTabularErrorDetail(body: unknown): string | undefined {
  if (typeof body !== "string" || body === "") return undefined;
  try {
    const parsed = tabularErrorBodySchema.safeParse(JSON.parse(body));
    const first = parsed.success ? parsed.data.errors?.[0] : undefined;
    if (!first) return body.slice(0, 200);
    if (typeof first.detail === "string") return first.detail;
    return first.detail?.message ?? first.title ?? undefined;
  } catch {
    return body.slice(0, 200);
  }
}

export class HttpTabularClient implements TabularClient {
  private readonly log = childLogger("tabular-client");

  constructor(private readonly deps: TabularClientDeps) {}

  private url(path: string, query?: QueryParams): URL {
    return buildUrl(this.deps.baseUrls.tabularApi, path, query);
  }

  async getResourceMeta(resourceId: string): Promise<TabularResourceMeta | undefined> {
    const url = this.url(`resources/${encodeURIComponent(resourceId)}/`);
    return this.deps.cache.getOrLoad(
      `tabular:meta:${resourceId}`,
      async () => {
        try {
          const body = await this.deps.http.getJson(url, { schema: tabularResourceMetaSchema });
          const link = (rel: string) => body.links?.find((l) => l.rel === rel)?.href ?? undefined;
          return {
            resourceId,
            createdAt: body.created_at ?? undefined,
            url: body.url ?? undefined,
            profileUrl: link("profile"),
            dataUrl: link("data"),
            swaggerUrl: link("swagger"),
          };
        } catch (error) {
          if (error instanceof NotFoundError) return undefined;
          throw mapTabularError(error, resourceId);
        }
      },
      { ttlMs: PROFILE_TTL_MS },
    );
  }

  async isAvailable(resourceId: string): Promise<boolean> {
    return (await this.getResourceMeta(resourceId)) !== undefined;
  }

  async getProfile(resourceId: string): Promise<TableSchema | undefined> {
    const url = this.url(`resources/${encodeURIComponent(resourceId)}/profile/`);
    return this.deps.cache.getOrLoad(
      `tabular:profile:${resourceId}`,
      async () => {
        try {
          const body = await this.deps.http.getJson(url, { schema: tabularProfileSchema });
          return profileToTableSchema(body);
        } catch (error) {
          if (error instanceof NotFoundError) return undefined;
          throw mapTabularError(error, resourceId);
        }
      },
      { ttlMs: PROFILE_TTL_MS },
    );
  }

  queryData(resourceId: string, query: TabularQuery): Promise<TabularPage> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(
      Math.max(1, Math.floor(query.pageSize ?? TABULAR_DEFAULT_PAGE_SIZE)),
      TABULAR_MAX_PAGE_SIZE,
    );
    const url = this.url(
      `resources/${encodeURIComponent(resourceId)}/data/`,
      buildTabularQuery(query.filters, query.sort, page, pageSize),
    );
    return this.fetchPage(resourceId, url, page, pageSize, query.columns);
  }

  async aggregate(resourceId: string, aggregation: TabularAggregation): Promise<TabularPage> {
    if (!(await this.isAggregationAllowed(resourceId))) {
      throw new UnsupportedCapabilityError(
        `Aggregations (group by / count / avg…) are not enabled for resource '${resourceId}' on the Tabular API.`,
        {
          details: { resourceId },
          hint: "Use query_resource_data with filters and pagination, or the Parquet export for analytics.",
        },
      );
    }
    if (aggregation.groupBy.length === 0 && aggregation.metrics.length === 0) {
      throw new ValidationError("An aggregation needs at least one groupBy column or one metric.");
    }
    const page = Math.max(1, Math.floor(aggregation.page ?? 1));
    const pageSize = Math.min(
      Math.max(1, Math.floor(aggregation.pageSize ?? TABULAR_DEFAULT_PAGE_SIZE)),
      TABULAR_MAX_PAGE_SIZE,
    );
    const params = buildTabularQuery(aggregation.filters, aggregation.sort, page, pageSize);
    for (const column of aggregation.groupBy) params[`${column}__groupby`] = "true";
    for (const metric of aggregation.metrics) params[`${metric.column}__${metric.fn}`] = "true";
    const url = this.url(`resources/${encodeURIComponent(resourceId)}/data/`, params);
    return this.fetchPage(resourceId, url, page, pageSize, undefined);
  }

  private fetchPage(
    resourceId: string,
    url: URL,
    page: number,
    pageSize: number,
    columns: string[] | undefined,
  ): Promise<TabularPage> {
    return this.deps.cache.getOrLoad(
      `tabular:data:${resourceId}:${url.search}:${(columns ?? []).join(",")}`,
      async () => {
        this.log.debug({ url: url.href }, "tabular query");
        try {
          const body = await this.deps.http.getJson(url, { schema: tabularDataPageSchema });
          return {
            rows: projectRows(body.data, columns),
            page: body.meta?.page ?? page,
            pageSize: body.meta?.page_size ?? pageSize,
            total: body.meta?.total ?? body.data.length,
            nextUrl: body.links?.next ?? undefined,
          };
        } catch (error) {
          throw mapTabularError(error, resourceId);
        }
      },
      { ttlMs: DATA_TTL_MS },
    );
  }

  async isAggregationAllowed(resourceId: string): Promise<boolean> {
    const allowed = await this.deps.cache.getOrLoad(
      "tabular:aggregation-exceptions",
      async () => {
        const body = await this.deps.http.getJson(this.url("aggregation-exceptions/"), {
          schema: tabularAggregationExceptionsSchema,
        });
        return new Set<string>([...body.allowed, ...body.exceptions]);
      },
      { ttlMs: EXCEPTIONS_TTL_MS, staleOnError: true },
    );
    return allowed.has(resourceId);
  }

  getSwagger(resourceId: string): Promise<TabularSwagger> {
    const url = this.url(`resources/${encodeURIComponent(resourceId)}/swagger/`);
    return this.deps.cache.getOrLoad(
      `tabular:swagger:${resourceId}`,
      async () => {
        let text: string;
        try {
          text = await this.deps.http.getText(url);
        } catch (error) {
          throw mapTabularError(error, resourceId);
        }
        const raw = parseOpenApiDocument(text, url.href);
        return { columns: extractSwaggerColumns(raw), raw };
      },
      { ttlMs: PROFILE_TTL_MS },
    );
  }
}

/** Per-resource swagger lists `{column}__{operator}` query parameters; fold them per column. */
export function extractSwaggerColumns(spec: Record<string, unknown>): TabularSwagger["columns"] {
  const byColumn = new Map<string, Set<string>>();
  const paths = spec.paths;
  if (paths && typeof paths === "object") {
    for (const item of Object.values(paths as Record<string, unknown>)) {
      const get = (item as Record<string, unknown> | null)?.get as
        | Record<string, unknown>
        | undefined;
      const params = Array.isArray(get?.parameters) ? get.parameters : [];
      for (const p of params) {
        const name = (p as Record<string, unknown> | null)?.name;
        const match = typeof name === "string" ? /^(.+)__([a-z_]+)$/.exec(name) : null;
        if (!match) continue;
        const [, column = "", operator = ""] = match;
        const ops = byColumn.get(column) ?? new Set<string>();
        ops.add(operator);
        byColumn.set(column, ops);
      }
    }
  }
  return [...byColumn.entries()].map(([name, ops]) => ({ name, operators: [...ops].sort() }));
}

export function createTabularClient(deps: TabularClientDeps): TabularClient {
  return new HttpTabularClient(deps);
}
