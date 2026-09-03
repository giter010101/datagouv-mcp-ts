import type {
  DataserviceDetail,
  DataserviceSummary,
  DatasetDetail,
  DatasetSummary,
  LicenseInfo,
  OrganizationDetail,
  OrganizationSummary,
  Page,
  ResourceDetail,
  ReuseDetail,
  ReuseSummary,
  Row,
  SiteInfo,
  SpatialLevel,
  SpatialZone,
  TableSchema,
  TopicDetail,
  TopicElement,
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

export interface DatasetSearchFilters {
  /** Organization **id** (not slug). */
  organization?: string;
  tag?: string[];
  license?: string;
  format?: string;
  /** `hvd` | `inspire` | `spd` | `sr` (see `listBadges`). */
  badge?: string;
  /** Geozone id, e.g. `country:fr`, `fr:departement:75`. */
  geozone?: string;
  granularity?: string;
  /** schema.data.gouv.fr name, e.g. `etalab/schema-irve-statique`. */
  schema?: string;
  topic?: string;
}

export interface SearchDatasetsParams {
  query: string;
  page?: number;
  /** 1–100 (API hard limit). */
  pageSize?: number;
  /** created | last_update | reuses | followers | views, optionally prefixed with '-'. */
  sort?: string;
  lastUpdateRange?: "last_30_days" | "last_12_months" | "last_3_years";
  /** Optional facet filters passed through to API v2 search. */
  filters?: DatasetSearchFilters;
}

/** Facet buckets returned by API v2 `/datasets/search/` (only when the client asks for them). */
export type DatasetSearchFacets = Record<string, Array<{ value: string; count: number }>>;

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
  /** Organization id. */
  organizationId?: string;
  /** Reuse type (`application`, `api`, `visualization`, …). */
  type?: string;
  /** Reuse topic (`economy_and_business`, `transport_and_mobility`, …). */
  topic?: string;
  sort?: string;
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
  /** Same search with the facet distribution (`format`, `tag`, `license`, `badge`, …). */
  searchDatasetsWithFacets(
    params: SearchDatasetsParams,
  ): Promise<Page<DatasetSummary> & { facets: DatasetSearchFacets }>;
  /** Convenience: datasets carrying the `hvd` badge (High Value Datasets). */
  listHighValueDatasets(
    query?: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<DatasetSummary>>;
  getDataset(datasetIdOrSlug: string): Promise<DatasetDetail>;
  getResource(resourceId: string): Promise<ResourceDetail>;
  listDatasetResources(
    datasetId: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<ResourceDetail>>;
  searchOrganizations(params: SearchOrganizationsParams): Promise<Page<OrganizationSummary>>;
  getOrganization(organizationIdOrSlug: string): Promise<OrganizationDetail>;
  searchDataservices(params: SearchDataservicesParams): Promise<Page<DataserviceSummary>>;
  getDataservice(dataserviceId: string): Promise<DataserviceDetail>;
  listReuses(params: ListReusesParams): Promise<Page<ReuseSummary>>;
  getReuse(reuseIdOrSlug: string): Promise<ReuseDetail>;
  searchTopics(query: string, page?: number, pageSize?: number): Promise<Page<TopicSummary>>;
  /** Topic detail with the first page of its elements (references to datasets/reuses/…). */
  getTopic(topicIdOrSlug: string): Promise<TopicDetail & { elements: TopicElement[] }>;
  listTopicElements(
    topicIdOrSlug: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<TopicElement>>;
  /** Aggregated autocomplete over datasets/organizations/tags/zones (`/suggest/` endpoints). */
  suggest(query: string, size?: number): Promise<Suggestion[]>;
  suggestZones(query: string, size?: number): Promise<SpatialZone[]>;
  suggestTags(query: string, size?: number): Promise<string[]>;
  suggestFormats(query: string, size?: number): Promise<string[]>;
  listSpatialLevels(): Promise<SpatialLevel[]>;
  listSpatialGranularities(): Promise<SpatialLevel[]>;
  listLicenses(): Promise<LicenseInfo[]>;
  /** Badge id → label, e.g. `{ hvd: "High value datasets" }`. */
  listBadges(): Promise<Record<string, string>>;
  /** Registered schemas as seen by data.gouv.fr (`/datasets/schemas/`). */
  listRegisteredSchemas(): Promise<SchemaCatalogEntry[]>;
  getSite(): Promise<SiteInfo>;
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

export type TabularAggregateFunction = "count" | "avg" | "sum" | "min" | "max";

export interface TabularAggregation {
  groupBy: string[];
  metrics: Array<{ column: string; fn: TabularAggregateFunction }>;
  filters?: TabularFilter[];
  sort?: TabularSort[];
  page?: number;
  pageSize?: number;
}

/** `GET /resources/{rid}/` — presence means the resource is served by the Tabular API. */
export interface TabularResourceMeta {
  resourceId: string;
  createdAt: string | undefined;
  /** Source file URL as known by the Tabular API. */
  url: string | undefined;
  profileUrl: string | undefined;
  dataUrl: string | undefined;
  swaggerUrl: string | undefined;
}

/** Column-level query vocabulary parsed from the per-resource swagger. */
export interface TabularSwagger {
  columns: Array<{ name: string; operators: string[] }>;
  raw: Record<string, unknown>;
}

/** tabular-api.data.gouv.fr */
export interface TabularClient {
  /** `undefined` when the resource is not in the Tabular API (404). */
  getResourceMeta(resourceId: string): Promise<TabularResourceMeta | undefined>;
  /** Cheap availability check (`getResourceMeta !== undefined`). */
  isAvailable(resourceId: string): Promise<boolean>;
  /** `undefined` when the resource is not in the Tabular API (404). */
  getProfile(resourceId: string): Promise<TableSchema | undefined>;
  queryData(resourceId: string, query: TabularQuery): Promise<TabularPage>;
  /** Group-by / count / avg… — only for resources in the aggregation allow-list. */
  aggregate(resourceId: string, aggregation: TabularAggregation): Promise<TabularPage>;
  /** Whether aggregation operators (`__groupby`, `__count`, …) are enabled for this resource. */
  isAggregationAllowed(resourceId: string): Promise<boolean>;
  getSwagger(resourceId: string): Promise<TabularSwagger>;
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

export interface CrawlerHealth {
  version: string | undefined;
  environment: string | undefined;
  /** Feature flags reported by Hydra (`csv_analysis`, `csv_to_db`, `db_to_parquet`, …). */
  features: Record<string, boolean>;
}

/** crawler.data.gouv.fr (Hydra). */
export interface CrawlerClient {
  /** Resource IDs exempted from Tabular API size limits (cached ~1h, stale-on-error). */
  getResourceExceptions(): Promise<ReadonlySet<string>>;
  isException(resourceId: string): Promise<boolean>;
  getHealth(): Promise<CrawlerHealth>;
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

export interface ValidationReport {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  rows: number | undefined;
  errors: Array<Record<string, unknown>>;
  warnings: string[];
}

/** schema.data.gouv.fr catalogue + Validata. */
export interface SchemaClient {
  listSchemas(query?: string): Promise<SchemaCatalogEntry[]>;
  getSchema(
    name: string,
    version?: string,
  ): Promise<SchemaCatalogEntry & { fields: SchemaField[]; resolvedUrl: string }>;
  validateResource(schemaUrl: string, resourceUrl: string): Promise<ValidationReport>;
}

/** Everything the tools layer may depend on. Built once in `server/deps.ts`. */
export interface Clients {
  datagouv: DatagouvClient;
  tabular: TabularClient;
  metrics: MetricsClient;
  crawler: CrawlerClient;
  schema: SchemaClient;
}
