/**
 * Shared domain types (normalised views of data.gouv.fr entities).
 *
 * Clients (`src/clients`) translate raw API payloads into these shapes so that
 * formats/tools never depend on udata's exact JSON. Keep them small: they are
 * what ends up in `structuredContent`.
 */

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface Page<T> extends PageInfo {
  items: T[];
}

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string | undefined;
  url: string | undefined;
}

export interface DatasetSummary {
  id: string;
  slug: string;
  title: string;
  /** Plain-text short description as provided by the API (may be empty). */
  descriptionShort: string;
  organization: OrganizationRef | undefined;
  tags: string[];
  resourcesCount: number;
  lastUpdate: string | undefined;
  license: string | undefined;
  /** Web page on data.gouv.fr. */
  url: string;
}

export interface DatasetDetail extends DatasetSummary {
  description: string;
  createdAt: string | undefined;
  frequency: string | undefined;
  temporalCoverage: { start: string; end: string } | undefined;
  spatial: { zones: string[]; granularity: string | undefined } | undefined;
  badges: string[];
  /** schema.data.gouv.fr schema declared on the dataset, if any. */
  schema: SchemaRef | undefined;
  resources: ResourceSummary[];
  quality: Record<string, unknown> | undefined;
}

export type ResourceType = "main" | "documentation" | "update" | "api" | "code" | "other";
export type ResourceFiletype = "file" | "remote";

export interface SchemaRef {
  name: string;
  version: string | undefined;
  url: string | undefined;
}

export interface ResourceSummary {
  id: string;
  title: string;
  description: string | undefined;
  /** Publisher-declared format, lower-cased, may be empty. */
  format: string;
  mime: string | undefined;
  type: ResourceType;
  filetype: ResourceFiletype;
  filesize: number | undefined;
  url: string;
  /** Stable redirect `https://www.data.gouv.fr/api/1/datasets/r/{id}`. */
  latestUrl: string;
  previewUrl: string | undefined;
  createdAt: string | undefined;
  lastModified: string | undefined;
  schema: SchemaRef | undefined;
}

/** Hydra/Validata signals extracted from `resource.extras` (all optional). */
export interface ResourceAnalysis {
  checkAvailable: boolean | undefined;
  checkStatus: number | undefined;
  checkError: string | undefined;
  checkDate: string | undefined;
  detectedMime: string | undefined;
  contentLength: number | undefined;
  analysisError: string | undefined;
  parsingTable: string | undefined;
  parsingError: string | undefined;
  parquetUrl: string | undefined;
  parquetSize: number | undefined;
  geojsonUrl: string | undefined;
  pmtilesUrl: string | undefined;
  ogcMetadata: Record<string, unknown> | undefined;
  validation:
    | { schemaName: string; schemaVersion: string | undefined; valid: boolean; errorCount: number }
    | undefined;
}

export interface ResourceDetail extends ResourceSummary {
  datasetId: string;
  checksum: { type: string; value: string } | undefined;
  analysis: ResourceAnalysis;
  /** Raw extras kept for diagnostics (never dumped wholesale into tool text). */
  extras: Record<string, unknown>;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  acronym: string | undefined;
  badges: string[];
  metrics: { datasets?: number; reuses?: number; followers?: number; views?: number } | undefined;
  url: string;
}

export interface DataserviceSummary {
  id: string;
  title: string;
  description: string;
  organization: OrganizationRef | undefined;
  baseApiUrl: string | undefined;
  machineDocumentationUrl: string | undefined;
  tags: string[];
  url: string;
}

export interface DataserviceDetail extends DataserviceSummary {
  businessDocumentationUrl: string | undefined;
  license: string | undefined;
  availability: number | undefined;
  accessType: string | undefined;
  createdAt: string | undefined;
  lastModified: string | undefined;
  datasetsCount: number;
}

export interface ReuseSummary {
  id: string;
  title: string;
  slug: string;
  type: string | undefined;
  topic: string | undefined;
  organization: OrganizationRef | undefined;
  datasetsCount: number;
  url: string;
}

export interface TopicSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  url: string;
}

/** One row of the Tabular API / Metrics API: column name → JSON value. */
export type Row = Record<string, unknown>;

export type ColumnType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "json"
  | "geometry"
  | "unknown";

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  /** Upstream type label as reported (csv-detective, parquet, …). */
  nativeType: string | undefined;
  nullable: boolean | undefined;
  /** Optional profiling stats when cheaply available. */
  stats: Record<string, unknown> | undefined;
}

export interface TableSchema {
  columns: ColumnSchema[];
  rowCount: number | undefined;
  source: "tabular-api" | "parquet" | "inferred" | "declared-schema";
}

export interface TableSlice {
  columns: string[];
  rows: Row[];
  /** Total rows matching the query when known. */
  total: number | undefined;
  page: number | undefined;
  pageSize: number | undefined;
  hasNext: boolean;
  /** True when the slice was cut by a size/row budget. */
  truncated: boolean;
}
