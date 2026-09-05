import {
  asyncBufferFromHttp,
  readParquetMetadata,
  readParquetRows,
  schemaFromMetadata,
} from "../parsers/parquet.js";
import type { FormatsDeps, ResourceAccessor } from "../types.js";
import {
  createFileTableAccessor,
  DEFAULT_PREVIEW_LIMIT,
  queryParsedOrEngine,
  resourceUrl,
  tablePreview,
} from "./shared.js";

export function createParquetAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "parquet",
    capabilities: ["parquet"],
    supports: (ctx) => ctx.report.strategy === "parquet" || ctx.report.detectedFormat === "parquet",
    async getSchema(ctx) {
      const file = await asyncBufferFromHttp(deps.http, resourceUrl(ctx), {
        maxBytes: ctx.maxDownloadBytes,
        signal: ctx.signal,
      });
      return schemaFromMetadata(await readParquetMetadata(file));
    },
    async preview(ctx, options) {
      const limit = options?.limit ?? DEFAULT_PREVIEW_LIMIT;
      const file = await asyncBufferFromHttp(deps.http, resourceUrl(ctx), {
        maxBytes: ctx.maxDownloadBytes,
        signal: ctx.signal,
      });
      const metadata = await readParquetMetadata(file);
      const schema = schemaFromMetadata(metadata);
      const rows = await readParquetRows(file, metadata, { rowStart: 0, rowEnd: limit });
      return tablePreview({
        rows,
        columns: schema.columns.map((c) => c.name),
        schema,
        facts: { rowCount: schema.rowCount, source: "parquet" },
        truncated: (schema.rowCount ?? 0) > limit,
      });
    },
    query(ctx, spec) {
      return queryParsedOrEngine(deps, ctx, "parquet", spec);
    },
  };
}

export function createCsvAccessor(deps: FormatsDeps): ResourceAccessor {
  return createFileTableAccessor(deps, {
    id: "csv-stream",
    capabilities: ["stream_parse"],
    formats: new Set(["csv", "tsv", "txt"]),
    strategies: new Set(["stream-csv"]),
    engineFormat: (detected) => (detected === "tsv" ? "tsv" : "csv"),
  });
}
