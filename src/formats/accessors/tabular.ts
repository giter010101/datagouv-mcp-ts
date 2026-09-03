import { EngineUnavailableError, UnsupportedCapabilityError } from "../../core/errors.js";
import type { TableSchema, TableSlice } from "../../core/types.js";
import { DEFAULT_PAGE_SIZE, normalizePage } from "../engines/query.js";
import {
  asyncBufferFromHttp,
  readParquetMetadata,
  readParquetRows,
  schemaFromMetadata,
} from "../parsers/parquet.js";
import type { AccessContext, FormatsDeps, ResourceAccessor } from "../types.js";
import { DEFAULT_PREVIEW_LIMIT, tablePreview, tabularPageSlice } from "./shared.js";

function requireTabular(deps: FormatsDeps, ctx: AccessContext) {
  if (!deps.tabular) {
    throw new UnsupportedCapabilityError(
      `Tabular API is not configured; cannot query resource ${ctx.resource.id} server-side`,
      {
        details: { resourceId: ctx.resource.id },
        hint: "Stream-parse the file with preview_resource, or wire the Tabular API client.",
      },
    );
  }
  return deps.tabular;
}

export function createTabularApiAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "tabular-api",
    capabilities: ["tabular_api", "tabular_api_large"],
    supports: (ctx) =>
      ctx.report.strategy === "tabular-api" ||
      ctx.report.primary === "tabular_api" ||
      ctx.report.primary === "tabular_api_large",
    async getSchema(ctx): Promise<TableSchema | undefined> {
      return (await requireTabular(deps, ctx).getProfile(ctx.resource.id)) ?? undefined;
    },
    async preview(ctx, options) {
      const tabular = requireTabular(deps, ctx);
      const pageSize = options?.limit ?? DEFAULT_PREVIEW_LIMIT;
      const page = await tabular.queryData(ctx.resource.id, { page: 1, pageSize });
      const slice = tabularPageSlice(page.rows, page.page, page.pageSize, page.total);
      const notes: string[] = [];
      if (ctx.report.primary === "tabular_api_large") {
        notes.push(
          "Very large resource: always paginate and filter server-side; do not download the file.",
        );
      }
      return {
        kind: "table",
        table: slice,
        facts: {
          source: "tabular-api",
          total: page.total,
          tabularApi: ctx.report.urls.tabularApi,
        },
        notes,
      };
    },
    async query(ctx, spec): Promise<TableSlice> {
      const tabular = requireTabular(deps, ctx);
      if (spec.sql !== undefined) {
        throw new EngineUnavailableError("SQL is not executed by the Tabular API", {
          hint: "Use filters / sort / aggregate, or query the Hydra Parquet conversion with DuckDB enabled.",
        });
      }
      const { page, pageSize } = normalizePage(spec);
      if (spec.aggregate) {
        const allowed = (await tabular.isAggregationAllowed?.(ctx.resource.id)) ?? false;
        if (!allowed || !tabular.aggregate) {
          throw new UnsupportedCapabilityError(
            `Aggregations are not enabled for resource ${ctx.resource.id} on the Tabular API`,
            {
              details: { resourceId: ctx.resource.id },
              hint: "Use filters and pagination, or query a Parquet conversion when available.",
            },
          );
        }
        const result = await tabular.aggregate(ctx.resource.id, {
          groupBy: spec.aggregate.groupBy,
          metrics: spec.aggregate.metrics.map((m) => ({
            op: m.op,
            column: m.column,
          })),
          filters: spec.filters,
          sort: spec.sort,
          page,
          pageSize,
        });
        return tabularPageSlice(result.rows, result.page, result.pageSize, result.total);
      }
      const result = await tabular.queryData(ctx.resource.id, {
        page,
        pageSize: spec.pageSize ?? DEFAULT_PAGE_SIZE,
        filters: spec.filters,
        sort: spec.sort,
        columns: spec.columns,
      });
      return tabularPageSlice(result.rows, result.page, result.pageSize, result.total);
    },
  };
}

/** Hydra `analysis:parsing:parquet_url` — same Parquet reader, different URL. */
export function createHydraParquetAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "hydra-parquet",
    capabilities: ["parquet"],
    supports: (ctx) =>
      ctx.report.strategy === "hydra-parquet" ||
      (ctx.report.urls.parquet !== undefined && ctx.report.detectedFormat !== "parquet"),
    async getSchema(ctx) {
      const url = ctx.report.urls.parquet;
      if (!url) return undefined;
      const file = await asyncBufferFromHttp(deps.http, url, {
        maxBytes: ctx.maxDownloadBytes,
        signal: ctx.signal,
      });
      return schemaFromMetadata(await readParquetMetadata(file));
    },
    async preview(ctx, options) {
      const url = ctx.report.urls.parquet;
      if (!url) {
        throw new UnsupportedCapabilityError("No Hydra Parquet conversion URL on this resource", {
          hint: "Use stream parsing or the Tabular API when available.",
        });
      }
      const limit = options?.limit ?? DEFAULT_PREVIEW_LIMIT;
      const file = await asyncBufferFromHttp(deps.http, url, {
        maxBytes: ctx.maxDownloadBytes,
        signal: ctx.signal,
      });
      const metadata = await readParquetMetadata(file);
      const schema = schemaFromMetadata(metadata);
      const rows = await readParquetRows(file, metadata, { rowStart: 0, rowEnd: limit });
      return tablePreview(
        {
          rows,
          columns: schema.columns.map((c) => c.name),
          schema,
          facts: { source: "hydra-parquet", parquetUrl: url, rowCount: schema.rowCount },
          truncated: (schema.rowCount ?? 0) > limit,
        },
        ["Rows come from the Hydra Parquet conversion, not the original file."],
      );
    },
    async query(ctx, spec) {
      const url = ctx.report.urls.parquet;
      if (!url) {
        throw new UnsupportedCapabilityError("No Hydra Parquet conversion URL on this resource");
      }
      const engine = await deps.engines.select({
        format: "parquet",
        sizeBytes: ctx.report.sizeBytes,
        sql: spec.sql !== undefined,
      });
      return engine.queryUrl(url, "parquet", spec, ctx.signal);
    },
  };
}
