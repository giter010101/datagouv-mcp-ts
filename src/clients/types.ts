import type {
  DataserviceDetail,
  DataserviceSummary,
  DatasetDetail,
  DatasetSummary,
  OrganizationSummary,
  Page,
  ResourceDetail,
  ReuseSummary,
  Row,
  TableSchema,
  TopicSummary,
} from "../core/types.js";

/**
 * Client contracts (workstream A implements them in this directory).
 *
 * Rules:
 * - Every method returns normalised `core/types` shapes, never raw udata JSON.
 * - Every method throws `DatagouvError` subclasses only (see `core/errors.ts`).
 * - Read-only. No method mutates anything on data.gouv.fr.
 * - Implementations receive an `HttpClient` + `Cache` + `ApiBaseUrls`; they never call `fetch` directly.
 */

export interface SearchDatasetsParams {
  query: string;
  page?: number;
  /** 1–100 (API hard limit). */
  pageSize?: number;
  /** created | last_update | reuses | followers | views, optionally prefixed with '-'. */
  sort?: string;
  lastUpdateRange?: "last_30_days" | "last_12_months" | "last_3_years";
  /** Optional facet filters passed through to API v2 search. */
  filters?: {
    organization?: string;
    tag?: string[];
    license?: string;
    format?: string;
    badge?: string;
    geozone?: string;
    granularity?: string;
    schema?: string;
    topic?: string;
  };
}

export interface SearchOrganizationsParams {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  badge?: string;
  name?: string;
  businessNumberId?: string;
}

export interface SearchDataservicesParams {
  query: string;
  page?: number;
  pageSize?: number;
}

export interface ListReusesParams {
  query?: string;
  datasetId?: string;
  page?: number;
  pageSize?: number;
}

export interface Suggestion {
  id: string | undefined;
  text: string;
  /** dataset | organization | tag | format | zone … */
  kind: string;
  url: string | undefined;
}

/** udata API v1/v2 (catalogue). */
export interface DatagouvClient {
  searchDatasets(params: SearchDatasetsParams): Promise<Page<DatasetSummary>>;
  getDataset(datasetIdOrSlug: string): Promise<DatasetDetail>;
  getResource(resourceId: string): Promise<ResourceDetail>;
  listDatasetResources(
    datasetId: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<ResourceDetail>>;
  searchOrganizations(params: SearchOrganizationsParams): Promise<Page<OrganizationSummary>>;
  searchDataservices(params: SearchDataservicesParams): Promise<Page<DataserviceSummary>>;
  getDataservice(dataserviceId: string): Promise<DataserviceDetail>;
  listReuses(params: ListReusesParams): Promise<Page<ReuseSummary>>;
  searchTopics(query: string, page?: number, pageSize?: number): Promise<Page<TopicSummary>>;
  getTopic(topicIdOrSlug: string): Promise<TopicSummary & { elements: DatasetSummary[] }>;
  /** Aggregated autocomplete over datasets/organizations/tags/zones (`/suggest/` endpoints). */
  suggest(query: string, size?: number): Promise<Suggestion[]>;
  /** Fetch an OpenAPI/Swagger document (JSON or YAML) from an arbitrary URL. */
  fetchOpenApiSpec(url: string): Promise<Record<string, unknown>>;
}

export type TabularOperator =
  | "exact"
  | "differs"
  | "contains"
  | "in"
  | "less"
  | "greater"
  | "strictly_less"
  | "strictly_greater";

export interface TabularFilter {
  column: string;
  operator: TabularOperator;
  value: string;
}

export interface TabularSort {
  column: string;
  direction: "asc" | "desc";
}

export interface TabularQuery {
  page?: number;
  /** 1–200 (API hard limit). */
  pageSize?: number;
  filters?: TabularFilter[];
  sort?: TabularSort[];
  /** Restrict returned columns (client-side projection when unsupported upstream). */
  columns?: string[];
}

export interface TabularPage {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
  nextUrl: string | undefined;
}

/** tabular-api.data.gouv.fr */
export interface TabularClient {
  /** `undefined` when the resource is not in the Tabular API (404). */
  getProfile(resourceId: string): Promise<TableSchema | undefined>;
  queryData(resourceId: string, query: TabularQuery): Promise<TabularPage>;
  /** Whether aggregation operators (`__groupby`, `__count`, …) are enabled for this resource. */
  isAggregationAllowed(resourceId: string): Promise<boolean>;
}

export type MetricsModel = "datasets" | "resources" | "organizations" | "reuses" | "dataservices";

export interface MetricsRecord {
  month: string;
  values: Record<string, number | null>;
}

/** metric-api.data.gouv.fr (production only). */
export interface MetricsClient {
  getMonthlyMetrics(model: MetricsModel, id: string, limit?: number): Promise<MetricsRecord[]>;
}

/** crawler.data.gouv.fr (Hydra). */
export interface CrawlerClient {
  /** Resource IDs exempted from Tabular API size limits (cached ~1h, stale-on-error). */
  getResourceExceptions(): Promise<ReadonlySet<string>>;
}

export interface SchemaCatalogEntry {
  name: string;
  title: string;
  description: string;
  schemaType: "tableschema" | "jsonschema" | "other";
  schemaUrl: string;
  latestVersion: string | undefined;
  versions: string[];
  homepage: string | undefined;
  consolidationDatasetId: string | undefined;
}

export interface SchemaField {
  name: string;
  type: string;
  description: string | undefined;
  required: boolean;
  constraints: Record<string, unknown> | undefined;
}

/** schema.data.gouv.fr catalogue + Validata. */
export interface SchemaClient {
  listSchemas(query?: string): Promise<SchemaCatalogEntry[]>;
  getSchema(
    name: string,
    version?: string,
  ): Promise<SchemaCatalogEntry & { fields: SchemaField[] }>;
  validateResource(
    schemaUrl: string,
    resourceUrl: string,
  ): Promise<{ valid: boolean; errorCount: number; errors: Array<Record<string, unknown>> }>;
}

/** Everything the tools layer may depend on. Built once in `server/deps.ts`. */
export interface Clients {
  datagouv: DatagouvClient;
  tabular: TabularClient;
  metrics: MetricsClient;
  crawler: CrawlerClient;
  schema: SchemaClient;
}
