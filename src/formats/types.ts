import type { TabularFilter, TabularSort } from "../clients/types.js";
import type { ResourceDetail, Row, TableSchema, TableSlice } from "../core/types.js";

/**
 * Formats-layer contracts (workstream B implements them in this directory).
 *
 * The goal: one uniform way for tools to *inspect*, *preview* and *query* any
 * resource, whatever its format, chosen by **capability detection** rather than
 * by trusting the declared `format`.
 */

/**
 * What can be done with a resource. Ordered from most to least powerful; the
 * detector returns the best `primary` plus every applicable fallback.
 *
 * | Capability              | Meaning |
 * |-------------------------|---------|
 * | `tabular_api`           | Rows served by tabular-api.data.gouv.fr (filters, sort, pagination). |
 * | `tabular_api_large`     | Same, but a very large resource (crawler exception): warn about pagination. |
 * | `parquet`               | A Parquet file (native or Hydra conversion) can be read/queried. |
 * | `stream_parse`          | File must be downloaded and parsed in-process under size caps (CSV/TSV/XLSX/ODS/JSON/JSONL/XML…). |
 * | `geo_preview`           | GeoJSON (native or Hydra conversion): feature count, bbox, sample features. |
 * | `archive_inspect`       | ZIP/7z/tar/Shapefile/GPKG/KMZ: list entries / layer metadata only. |
 * | `document_preview`      | PDF/DOCX/ODT/TXT/MD: bounded text extraction. |
 * | `api_endpoint`          | WMS/WFS/ArcGIS/`type=api`: return service URL + capabilities link, never fetch blindly. |
 * | `remote_caution`        | External URL with unknown/large content: HEAD only unless explicitly asked. |
 * | `metadata_only`         | Nothing else applies (images, unknown binaries). |
 * | `dead_link`             | Hydra check says the URL is unavailable (4xx/5xx/timeout). |
 */
export const RESOURCE_CAPABILITIES = [
  "tabular_api",
  "tabular_api_large",
  "parquet",
  "stream_parse",
  "geo_preview",
  "archive_inspect",
  "document_preview",
  "api_endpoint",
  "remote_caution",
  "metadata_only",
  "dead_link",
] as const;

export type ResourceCapability = (typeof RESOURCE_CAPABILITIES)[number];

/** Coarse family used for routing and for the LLM ("this is a spreadsheet"). */
export type FormatFamily =
  | "tabular"
  | "spreadsheet"
  | "json"
  | "geo"
  | "archive"
  | "document"
  | "image"
  | "api"
  | "rdf"
  | "xml"
  | "unknown";

export interface CapabilityReport {
  resourceId: string;
  primary: ResourceCapability;
  /** All applicable capabilities, best first (includes `primary`). */
  capabilities: ResourceCapability[];
  formatFamily: FormatFamily;
  /** Normalised format actually detected (e.g. `csv.gz` → `csv`, empty → from mime). */
  detectedFormat: string;
  /** Human-readable reasons, e.g. "extras.analysis:parsing:parsing_table present". */
  reasons: string[];
  /** Safe URLs the caller may use. */
  urls: {
    download: string;
    latest: string;
    parquet: string | undefined;
    geojson: string | undefined;
    preview: string | undefined;
    tabularApi: string | undefined;
  };
  /** Size known from metadata (filesize or analysis:content-length). */
  sizeBytes: number | undefined;
  /** Result of the optional Tabular API `/profile/` probe. */
  tabularProbe: "available" | "unavailable" | "skipped" | "error";
  /** Warnings for the LLM (huge file, dead link date, format mismatch…). */
  warnings: string[];
}

export interface CapabilityDetectorDeps {
  /** Probe tabular-api `/profile/` (returns schema or undefined for 404). */
  probeTabular: (resourceId: string) => Promise<TableSchema | undefined>;
  /** Set of resource IDs exempted from Tabular size limits. */
  crawlerExceptions: () => Promise<ReadonlySet<string>>;
  tabularApiBaseUrl: string;
}

export interface DetectOptions {
  /** Skip network probes (pure metadata decision). Default false. */
  offline?: boolean;
}

export type CapabilityDetector = (
  resource: ResourceDetail,
  options?: DetectOptions,
) => Promise<CapabilityReport>;

export interface AccessContext {
  resource: ResourceDetail;
  report: CapabilityReport;
  /** Hard cap on bytes downloaded for in-process parsing. */
  maxDownloadBytes: number;
  signal?: AbortSignal;
}

export interface PreviewOptions {
  /** Max rows / features / characters depending on the accessor. */
  limit?: number;
  /** For multi-table containers (XLSX sheets, GPKG layers, ZIP members). */
  member?: string;
}

export interface QuerySpec {
  filters?: TabularFilter[];
  sort?: TabularSort[];
  columns?: string[];
  page?: number;
  pageSize?: number;
  /** Optional SQL for engines that support it (DuckDB). Read-only SELECT only. */
  sql?: string;
}

export interface PreviewResult {
  kind: "table" | "features" | "text" | "entries" | "metadata";
  table?: TableSlice;
  /** GeoJSON features or archive entries or plain text; small by construction. */
  features?: Row[];
  text?: string;
  entries?: Array<{ name: string; sizeBytes: number | undefined; kind: string | undefined }>;
  /** Extra facts (bbox, sheet names, page count, encoding, delimiter…). */
  facts: Record<string, unknown>;
  notes: string[];
}

/**
 * Uniform access to one resource for a given capability. Implementations live
 * in `src/formats/accessors/*` and are registered in `AccessorRegistry`.
 */
export interface ResourceAccessor {
  /** Stable id, e.g. `tabular-api`, `csv-stream`, `parquet-hyparquet`, `geojson`. */
  readonly id: string;
  /** Capabilities this accessor can serve. */
  readonly capabilities: readonly ResourceCapability[];
  /** Optional finer check (e.g. only for `detectedFormat === "csv"`). */
  supports(ctx: AccessContext): boolean;
  getSchema(ctx: AccessContext): Promise<TableSchema | undefined>;
  preview(ctx: AccessContext, options?: PreviewOptions): Promise<PreviewResult>;
  /** Only for accessors able to filter/sort; others throw `UnsupportedCapabilityError`. */
  query?(ctx: AccessContext, spec: QuerySpec): Promise<TableSlice>;
}

/**
 * Pluggable analytical engine (DuckDB behind a feature flag, pure-JS fallback).
 * Engines read remote files by URL; they never receive raw SQL from the LLM
 * without the tools layer validating it is a single read-only SELECT.
 */
export interface QueryEngine {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  /** Run a read-only query over the file at `url` (`format`: csv | parquet | json | xlsx). */
  queryUrl(url: string, format: string, spec: QuerySpec, signal?: AbortSignal): Promise<TableSlice>;
  describeUrl(url: string, format: string, signal?: AbortSignal): Promise<TableSchema>;
}
