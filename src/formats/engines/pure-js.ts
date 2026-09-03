import { EngineUnavailableError, FormatError } from "../../core/errors.js";
import type { HttpClient } from "../../core/http.js";
import type { Row, TableSchema, TableSlice } from "../../core/types.js";
import { charsetOf, decodeText, downloadBounded } from "../download.js";
import { coerceRows, inferSchema } from "../infer.js";
import { parseCsv } from "../parsers/csv.js";
import { geoJsonToTable, isGeoJson } from "../parsers/geojson.js";
import { looksLikeJsonl, parseJsonl, parseJsonText, recordsFromJson } from "../parsers/json.js";
import {
  asyncBufferFromBytes,
  readParquetMetadata,
  readParquetRows,
  schemaFromMetadata,
} from "../parsers/parquet.js";
import { parseSheet } from "../parsers/spreadsheet.js";
import { xmlToRecords } from "../parsers/xml.js";
import type { QueryEngine, QuerySpec } from "../types.js";
import { applyQuery } from "./query.js";

/**
 * Always-available engine: bounded download → format parser → in-memory
 * `applyQuery`. Rejects `sql` (use DuckDB). Whole-table loads are capped by
 * `maxDownloadBytes`; larger files raise `PAYLOAD_TOO_LARGE` with a hint.
 */

export interface LoadedTable {
  rows: Row[];
  columns: string[];
  schema: TableSchema;
  facts: Record<string, unknown>;
}

export interface LoadOptions {
  maxBytes: number;
  signal?: AbortSignal;
  /** Container member (sheet name…). */
  member?: string;
}

export const ENGINE_FORMATS = [
  "csv",
  "tsv",
  "txt",
  "json",
  "jsonl",
  "geojson",
  "xlsx",
  "xls",
  "ods",
  "parquet",
  "xml",
] as const;

/** Download a whole file (bounded) and parse it into rows according to `format`. */
export async function loadTable(
  http: HttpClient,
  url: string,
  format: string,
  options: LoadOptions,
): Promise<LoadedTable> {
  const download = await downloadBounded(http, url, {
    maxBytes: options.maxBytes,
    signal: options.signal,
    onOverflow: "throw",
  });
  const facts: Record<string, unknown> = { bytes: download.bytes.byteLength };
  if (download.compression) facts.compression = download.compression;
  const bytes = download.bytes;
  const text = () => {
    const decoded = decodeText(bytes, charsetOf(download.contentType));
    facts.encoding = decoded.encoding;
    return decoded.text;
  };
  switch (format) {
    case "csv":
    case "tsv":
    case "txt": {
      const parsed = parseCsv(text(), { delimiter: format === "tsv" ? "\t" : undefined });
      facts.delimiter = parsed.dialect.delimiter;
      const schema = inferSchema(parsed.rows, { complete: true });
      return { rows: coerceRows(parsed.rows, schema), columns: parsed.columns, schema, facts };
    }
    case "xlsx":
    case "xls":
    case "ods": {
      const parsed = parseSheet(bytes, { sheet: options.member });
      facts.sheet = parsed.sheet;
      facts.sheets = parsed.sheets.map((s) => s.name);
      const schema = inferSchema(parsed.rows, { complete: true });
      return { rows: coerceRows(parsed.rows, schema), columns: parsed.columns, schema, facts };
    }
    case "json":
    case "jsonl":
    case "geojson": {
      const content = text();
      if (format === "jsonl" || (format === "json" && looksLikeJsonl(content))) {
        const parsed = parseJsonl(content);
        const schema = inferSchema(parsed.rows, { complete: true });
        return { rows: parsed.rows, columns: schema.columns.map((c) => c.name), schema, facts };
      }
      const doc = parseJsonText(content);
      if (isGeoJson(doc)) {
        const table = geoJsonToTable(doc);
        facts.featureCount = table.featureCount;
        facts.bbox = table.bbox;
        const schema = inferSchema(table.rows, { complete: true });
        return { rows: table.rows, columns: table.columns, schema, facts };
      }
      const records = recordsFromJson(doc);
      facts.recordsPath = records.recordsPath;
      const schema = inferSchema(records.rows, { complete: true });
      return { rows: records.rows, columns: schema.columns.map((c) => c.name), schema, facts };
    }
    case "xml": {
      const records = xmlToRecords(text());
      facts.recordsPath = records.recordsPath;
      const schema = inferSchema(records.rows, { complete: true });
      return { rows: records.rows, columns: schema.columns.map((c) => c.name), schema, facts };
    }
    case "parquet": {
      const file = asyncBufferFromBytes(bytes);
      const metadata = await readParquetMetadata(file);
      const rows = await readParquetRows(file, metadata, {});
      const schema = schemaFromMetadata(metadata);
      return { rows, columns: schema.columns.map((c) => c.name), schema, facts };
    }
    default:
      throw new FormatError(`The pure-JS engine cannot read "${format}" files`, {
        hint: `Supported: ${ENGINE_FORMATS.join(", ")}.`,
      });
  }
}

export interface PureJsEngineOptions {
  http: HttpClient;
  maxDownloadBytes: number;
}

export function createPureJsEngine(options: PureJsEngineOptions): QueryEngine {
  return {
    id: "pure-js",
    isAvailable: async () => true,
    async queryUrl(url, format, spec: QuerySpec, signal) {
      if (spec.sql !== undefined) {
        throw new EngineUnavailableError("SQL queries require the DuckDB engine (not enabled)", {
          hint: "Use filters / sort / aggregate instead of sql, or set ENABLE_DUCKDB=1 with @duckdb/node-api installed.",
        });
      }
      const table = await loadTable(options.http, url, format, {
        maxBytes: options.maxDownloadBytes,
        signal,
      });
      return applyQuery(table.rows, spec, { complete: true, columns: table.columns });
    },
    async describeUrl(url, format, signal): Promise<TableSchema> {
      const table = await loadTable(options.http, url, format, {
        maxBytes: options.maxDownloadBytes,
        signal,
      });
      return table.schema;
    },
  } satisfies QueryEngine & {
    queryUrl(u: string, f: string, s: QuerySpec, sig?: AbortSignal): Promise<TableSlice>;
  };
}
