import { FormatError } from "../../core/errors.js";
import type { Row, TableSchema } from "../../core/types.js";
import { charsetOf, decodeText } from "../download.js";
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

/** In-memory table produced by a stream parser (shared by accessors). */
export interface ParsedTable {
  rows: Row[];
  columns: string[];
  schema: TableSchema;
  facts: Record<string, unknown>;
  truncated: boolean;
}

export interface ParseBytesOptions {
  format: string;
  contentType?: string;
  member?: string;
  limit?: number;
  inputTruncated?: boolean;
}

function decoded(
  bytes: Uint8Array,
  contentType: string | undefined,
): {
  text: string;
  encoding: string;
} {
  const decodedText = decodeText(bytes, charsetOf(contentType));
  return { text: decodedText.text, encoding: decodedText.encoding };
}

/**
 * Parse already-downloaded bytes with the same vocabulary as the pure-JS engine.
 * `limit` bounds rows for previews; omit it for a full (still size-capped) load.
 */
export async function parseTableBytes(
  bytes: Uint8Array,
  options: ParseBytesOptions,
): Promise<ParsedTable> {
  const facts: Record<string, unknown> = { bytes: bytes.byteLength };
  const format = options.format;
  const truncatedInput = options.inputTruncated === true;

  switch (format) {
    case "csv":
    case "tsv":
    case "txt": {
      const { text, encoding } = decoded(bytes, options.contentType);
      facts.encoding = encoding;
      const parsed = parseCsv(text, {
        delimiter: format === "tsv" ? "\t" : undefined,
        limit: options.limit,
        inputTruncated: truncatedInput,
      });
      facts.delimiter = parsed.dialect.delimiter;
      const schema = inferSchema(parsed.rows, {
        complete: !parsed.truncated && !truncatedInput,
        rowCount: parsed.truncated || truncatedInput ? undefined : parsed.rows.length,
      });
      return {
        rows: coerceRows(parsed.rows, schema),
        columns: parsed.columns,
        schema,
        facts,
        truncated: parsed.truncated || truncatedInput,
      };
    }
    case "xlsx":
    case "xls":
    case "ods": {
      const parsed = parseSheet(bytes, { sheet: options.member, limit: options.limit });
      facts.sheet = parsed.sheet;
      facts.sheets = parsed.sheets.map((s) => s.name);
      facts.headerRow = parsed.headerRow;
      const schema = inferSchema(parsed.rows, {
        complete: !parsed.truncated,
        rowCount: parsed.totalDataRows,
      });
      return {
        rows: coerceRows(parsed.rows, schema),
        columns: parsed.columns,
        schema,
        facts,
        truncated: parsed.truncated,
      };
    }
    case "json":
    case "jsonl":
    case "geojson": {
      const { text, encoding } = decoded(bytes, options.contentType);
      facts.encoding = encoding;
      if (format === "jsonl" || (format === "json" && looksLikeJsonl(text))) {
        const parsed = parseJsonl(text, {
          limit: options.limit,
          inputTruncated: truncatedInput,
        });
        const schema = inferSchema(parsed.rows, {
          complete: !parsed.truncated,
          rowCount: parsed.total,
        });
        facts.recordsPath = parsed.recordsPath;
        return {
          rows: parsed.rows,
          columns: schema.columns.map((c) => c.name),
          schema,
          facts,
          truncated: parsed.truncated,
        };
      }
      const doc = parseJsonText(text);
      if (isGeoJson(doc) || format === "geojson") {
        const table = geoJsonToTable(doc, options.limit);
        facts.featureCount = table.featureCount;
        facts.bbox = table.bbox;
        facts.geometryTypes = table.geometryTypes;
        if (table.crs) facts.crs = table.crs;
        const schema = inferSchema(table.rows, {
          complete: !table.truncated,
          rowCount: table.featureCount,
        });
        return {
          rows: table.rows,
          columns: table.columns,
          schema,
          facts,
          truncated: table.truncated,
        };
      }
      const records = recordsFromJson(doc, options.limit);
      facts.recordsPath = records.recordsPath;
      if (records.topLevelKeys) facts.topLevelKeys = records.topLevelKeys;
      const schema = inferSchema(records.rows, {
        complete: !records.truncated,
        rowCount: records.total,
      });
      return {
        rows: records.rows,
        columns: schema.columns.map((c) => c.name),
        schema,
        facts,
        truncated: records.truncated,
      };
    }
    case "xml":
    case "kml":
    case "gpx":
    case "gml": {
      const { text, encoding } = decoded(bytes, options.contentType);
      facts.encoding = encoding;
      const records = xmlToRecords(text, {
        limit: options.limit,
        inputTruncated: truncatedInput,
      });
      facts.recordsPath = records.recordsPath;
      facts.rootElement = records.rootElement;
      const schema = inferSchema(records.rows, {
        complete: !records.truncated,
        rowCount: records.total,
      });
      return {
        rows: records.rows,
        columns: schema.columns.map((c) => c.name),
        schema,
        facts,
        truncated: records.truncated,
      };
    }
    case "parquet": {
      const file = asyncBufferFromBytes(bytes);
      const metadata = await readParquetMetadata(file);
      const schema = schemaFromMetadata(metadata);
      const rowEnd = options.limit;
      const rows = await readParquetRows(file, metadata, {
        rowStart: 0,
        rowEnd: rowEnd !== undefined ? rowEnd : undefined,
      });
      facts.rowCount = schema.rowCount;
      const truncated = rowEnd !== undefined && (schema.rowCount ?? 0) > rowEnd;
      return { rows, columns: schema.columns.map((c) => c.name), schema, facts, truncated };
    }
    default:
      throw new FormatError(`No in-process parser for format "${format}"`, {
        hint: "Use get_resource_info for the download URL, or pick a CSV / JSON / spreadsheet / Parquet resource.",
      });
  }
}
