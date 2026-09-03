import type {
  DatasetDetail,
  DatasetSummary,
  OrganizationRef,
  ResourceAnalysis,
  ResourceDetail,
  ResourceFiletype,
  ResourceSummary,
  ResourceType,
  SchemaRef,
} from "../../core/types.js";
import type { ApiDatasetDetail, ApiResource, ApiSchemaRef } from "../schemas/datagouv-dataset.js";
import type { ApiDatasetSearchItem } from "../schemas/datagouv-search.js";
import { summarizeDescription } from "./text.js";

const RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set([
  "main",
  "documentation",
  "update",
  "api",
  "code",
  "other",
]);

export function toOrganizationRef(
  org: ApiDatasetSearchItem["organization"],
  site: string,
): OrganizationRef | undefined {
  if (!org) return undefined;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug ?? undefined,
    url: org.page ?? new URL(`organizations/${org.slug ?? org.id}/`, site).href,
  };
}

export function toSchemaRef(schema: ApiSchemaRef): SchemaRef | undefined {
  if (!schema || !schema.name) return undefined;
  return { name: schema.name, version: schema.version ?? undefined, url: schema.url ?? undefined };
}

export function toDatasetSummary(item: ApiDatasetSearchItem, site: string): DatasetSummary {
  const slug = item.slug || item.id;
  return {
    id: item.id,
    slug,
    title: item.title,
    // Live API v2 returns `description_short: null`; derive it from the markdown description.
    descriptionShort: item.description_short || summarizeDescription(item.description),
    organization: toOrganizationRef(item.organization, site),
    tags: item.tags ?? [],
    resourcesCount: resourcesTotal(item.resources),
    lastUpdate: item.last_update ?? undefined,
    license: item.license ?? undefined,
    url: new URL(`datasets/${slug}/`, site).href,
  };
}

function resourcesTotal(
  resources: ApiDatasetDetail["resources"] | ApiDatasetSearchItem["resources"],
): number {
  if (!resources) return 0;
  if (Array.isArray(resources)) return resources.length;
  return resources.total ?? 0;
}

export function toDatasetDetail(
  raw: ApiDatasetDetail,
  site: string,
  apiBase: string,
): DatasetDetail {
  const summary = toDatasetSummary(raw, site);
  const resources = Array.isArray(raw.resources) ? raw.resources : [];
  return {
    ...summary,
    description: raw.description ?? "",
    createdAt: raw.created_at ?? undefined,
    frequency: raw.frequency ?? undefined,
    temporalCoverage:
      raw.temporal_coverage?.start && raw.temporal_coverage.end
        ? { start: raw.temporal_coverage.start, end: raw.temporal_coverage.end }
        : undefined,
    spatial: raw.spatial
      ? { zones: raw.spatial.zones ?? [], granularity: raw.spatial.granularity ?? undefined }
      : undefined,
    badges: (raw.badges ?? []).map((b) => b.kind),
    schema: toSchemaRef(raw.schema),
    resources: resources.map((r) => toResourceSummary(r, apiBase)),
    quality: raw.quality ?? undefined,
  };
}

export function toResourceSummary(raw: ApiResource, apiBase: string): ResourceSummary {
  const type = (raw.type ?? "other").toLowerCase();
  return {
    id: raw.id,
    title: raw.title ?? "",
    description: raw.description ?? undefined,
    format: (raw.format ?? "").toLowerCase(),
    mime: raw.mime ?? undefined,
    type: RESOURCE_TYPES.has(type as ResourceType) ? (type as ResourceType) : "other",
    filetype: (raw.filetype === "remote" ? "remote" : "file") as ResourceFiletype,
    filesize: raw.filesize ?? undefined,
    url: raw.url,
    latestUrl: raw.latest ?? new URL(`1/datasets/r/${raw.id}`, apiBase).href,
    previewUrl: raw.preview_url ?? undefined,
    createdAt: raw.created_at ?? undefined,
    lastModified: raw.last_modified ?? undefined,
    schema: toSchemaRef(raw.schema),
  };
}

export function toResourceDetail(
  raw: ApiResource,
  datasetId: string,
  apiBase: string,
): ResourceDetail {
  const extras = raw.extras ?? {};
  return {
    ...toResourceSummary(raw, apiBase),
    datasetId,
    checksum:
      raw.checksum?.type && raw.checksum.value
        ? { type: raw.checksum.type, value: raw.checksum.value }
        : undefined,
    analysis: extractAnalysis(extras),
    extras,
  };
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

/** Hydra `check:*` / `analysis:*` and Validata `validation-report:*` extras → typed signals. */
export function extractAnalysis(extras: Record<string, unknown>): ResourceAnalysis {
  const schemaName = str(extras["validation-report:schema_name"]);
  const errorCount = num(extras["validation-report:nb_errors"]);
  const valid = bool(extras["validation-report:valid_resource"]);
  return {
    checkAvailable: bool(extras["check:available"]),
    checkStatus: num(extras["check:status"]),
    checkError: str(extras["check:error"]),
    checkDate: str(extras["check:date"]),
    detectedMime: str(extras["analysis:mime-type"]) ?? str(extras["check:headers:content-type"]),
    contentLength:
      num(extras["analysis:content-length"]) ?? num(extras["check:headers:content-length"]),
    analysisError: str(extras["analysis:error"]),
    parsingTable: str(extras["analysis:parsing:parsing_table"]),
    parsingError: str(extras["analysis:parsing:error"]),
    parquetUrl: str(extras["analysis:parsing:parquet_url"]),
    parquetSize: num(extras["analysis:parsing:parquet_size"]),
    geojsonUrl: str(extras["analysis:parsing:geojson_url"]),
    pmtilesUrl: str(extras["analysis:parsing:pmtiles_url"]),
    ogcMetadata: obj(extras["ogc:metadata"]) ?? obj(extras["analysis:ogc:metadata"]),
    validation:
      schemaName !== undefined && valid !== undefined
        ? {
            schemaName,
            schemaVersion: str(extras["validation-report:schema_version"]),
            valid,
            errorCount: errorCount ?? 0,
          }
        : undefined,
  };
}
