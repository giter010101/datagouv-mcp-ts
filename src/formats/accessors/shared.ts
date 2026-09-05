import { UnsupportedCapabilityError } from "../../core/errors.js";
import type { TableSlice } from "../../core/types.js";
import { type DownloadResult, downloadBounded } from "../download.js";
import { applyQuery } from "../engines/query.js";
import { columnNames } from "../infer.js";
import type {
  AccessContext,
  AccessStrategy,
  FormatsDeps,
  PreviewResult,
  QuerySpec,
  ResourceAccessor,
  ResourceCapability,
} from "../types.js";
import { type ParsedTable, parseTableBytes } from "./parse-bytes.js";

export const DEFAULT_PREVIEW_LIMIT = 20;

export function resourceUrl(
  ctx: AccessContext,
  which: "download" | "parquet" | "geojson" = "download",
): string {
  if (which === "parquet" && ctx.report.urls.parquet) return ctx.report.urls.parquet;
  if (which === "geojson" && ctx.report.urls.geojson) return ctx.report.urls.geojson;
  return ctx.report.urls.download || ctx.resource.url;
}

export async function downloadForAccess(
  deps: FormatsDeps,
  ctx: AccessContext,
  url: string,
  overflow: "throw" | "truncate",
): Promise<DownloadResult> {
  return downloadBounded(deps.http, url, {
    maxBytes: ctx.maxDownloadBytes,
    onOverflow: overflow,
    signal: ctx.signal,
  });
}

export async function loadParsedTable(
  deps: FormatsDeps,
  ctx: AccessContext,
  options: {
    url?: string;
    format: string;
    overflow: "throw" | "truncate";
    limit?: number;
    member?: string;
  },
): Promise<ParsedTable & { download: DownloadResult }> {
  const download = await downloadForAccess(
    deps,
    ctx,
    options.url ?? resourceUrl(ctx),
    options.overflow,
  );
  const table = await parseTableBytes(download.bytes, {
    format: options.format,
    contentType: download.contentType,
    member: options.member ?? ctx.member,
    limit: options.limit,
    inputTruncated: download.truncated,
  });
  if (download.compression) table.facts.compression = download.compression;
  return { ...table, download };
}

export function tableSliceOf(
  table: ParsedTable,
  spec: QuerySpec = { page: 1, pageSize: DEFAULT_PREVIEW_LIMIT },
): TableSlice {
  return applyQuery(table.rows, spec, {
    complete: !table.truncated,
    columns: table.columns.length > 0 ? table.columns : columnNames(table.rows),
  });
}

export function tablePreview(table: ParsedTable, extraNotes: string[] = []): PreviewResult {
  const slice = tableSliceOf(table, { page: 1, pageSize: DEFAULT_PREVIEW_LIMIT });
  const notes = [...extraNotes];
  if (table.truncated) {
    notes.push(
      "Preview is truncated by the in-process size/row budget; filter with query_resource or use the Tabular API / Parquet path.",
    );
  }
  return { kind: "table", table: slice, facts: table.facts, notes };
}

export function metadataPreview(
  ctx: AccessContext,
  extra: Record<string, unknown> = {},
  notes: string[] = [],
): PreviewResult {
  return {
    kind: "metadata",
    facts: {
      title: ctx.resource.title,
      format: ctx.report.detectedFormat || ctx.resource.format || "unknown",
      mime: ctx.resource.mime,
      sizeBytes: ctx.report.sizeBytes,
      url: ctx.report.urls.latest,
      download: ctx.report.urls.download,
      ...extra,
    },
    notes: [...ctx.report.warnings, ...notes],
  };
}

/** Preview fallback used by `openResource` — never throws. */
export function degradePreview(ctx: AccessContext, error: unknown): PreviewResult {
  const message = error instanceof Error ? error.message : String(error);
  return metadataPreview(ctx, { error: message }, [
    message,
    "Data could not be parsed in-process. Use the download URL, or try another resource of the dataset.",
  ]);
}

export async function queryParsedOrEngine(
  deps: FormatsDeps,
  ctx: AccessContext,
  format: string,
  spec: QuerySpec,
  url?: string,
): Promise<TableSlice> {
  const target = url ?? resourceUrl(ctx);
  const engine = await deps.engines.select({
    format,
    sizeBytes: ctx.report.sizeBytes,
    sql: spec.sql !== undefined,
  });
  return engine.queryUrl(target, format, spec, ctx.signal);
}

export function formatMatches(
  ctx: AccessContext,
  formats: ReadonlySet<string>,
  strategies: ReadonlySet<AccessStrategy>,
): boolean {
  if (strategies.has(ctx.report.strategy)) return true;
  return formats.has(ctx.report.detectedFormat);
}

export function unsupportedQuery(ctx: AccessContext, accessorId: string): never {
  throw new UnsupportedCapabilityError(
    `Accessor ${accessorId} cannot run filtered queries on resource ${ctx.resource.id}`,
    {
      details: { resourceId: ctx.resource.id, accessor: accessorId, primary: ctx.report.primary },
      hint: "Use preview_resource for a sample, or the download URL from get_resource_info.",
    },
  );
}

export function tabularPageSlice(
  rows: Array<Record<string, unknown>>,
  page: number,
  pageSize: number,
  total: number,
): TableSlice {
  const columns = columnNames(rows);
  return {
    columns,
    rows,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
    truncated: false,
  };
}

export interface FileAccessorConfig {
  id: string;
  capabilities: readonly ResourceCapability[];
  formats: ReadonlySet<string>;
  strategies: ReadonlySet<AccessStrategy>;
  /** Format passed to parsers / engines. */
  engineFormat: (detected: string) => string;
}

export function createFileTableAccessor(
  deps: FormatsDeps,
  config: FileAccessorConfig,
): ResourceAccessor {
  return {
    id: config.id,
    capabilities: config.capabilities,
    supports: (ctx) => formatMatches(ctx, config.formats, config.strategies),
    async getSchema(ctx) {
      const format = config.engineFormat(ctx.report.detectedFormat);
      const table = await loadParsedTable(deps, ctx, {
        format,
        overflow: "truncate",
        limit: 200,
      });
      return table.schema;
    },
    async preview(ctx, options) {
      const format = config.engineFormat(ctx.report.detectedFormat);
      const table = await loadParsedTable(deps, ctx, {
        format,
        overflow: "truncate",
        limit: options?.limit ?? DEFAULT_PREVIEW_LIMIT,
        member: options?.member,
      });
      return tablePreview(table);
    },
    query(ctx, spec) {
      const format = config.engineFormat(ctx.report.detectedFormat);
      return queryParsedOrEngine(deps, ctx, format, spec);
    },
  };
}
