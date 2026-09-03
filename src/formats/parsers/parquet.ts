import {
  type AsyncBuffer,
  type FileMetaData,
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
  type SchemaTree,
} from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { FormatError } from "../../core/errors.js";
import type { HttpClient } from "../../core/http.js";
import type { ColumnSchema, ColumnType, Row, TableSchema } from "../../core/types.js";
import { downloadBounded, probeUrl, toDownloadError } from "../download.js";

/**
 * Parquet via hyparquet: footer metadata (schema + row count) and row-group
 * reads with column projection. Remote files are read with HTTP range requests
 * so memory stays bounded by the rows actually requested.
 */

export function asyncBufferFromBytes(bytes: Uint8Array): AsyncBuffer {
  return {
    byteLength: bytes.byteLength,
    slice: (start, end) => {
      const view = bytes.subarray(start, end ?? bytes.byteLength);
      return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
    },
  };
}

/** Range-request backed buffer over `http` (falls back to a bounded full download when Range is unsupported). */
export async function asyncBufferFromHttp(
  http: HttpClient,
  url: string,
  options: { maxBytes: number; signal?: AbortSignal },
): Promise<AsyncBuffer> {
  const probe = await probeUrl(http, url, { signal: options.signal });
  if (!probe.ok) throw toDownloadError(new Error(`HTTP ${probe.status}`), url);
  if (probe.contentLength === undefined || !probe.acceptRanges) {
    const whole = await downloadBounded(http, url, {
      maxBytes: options.maxBytes,
      decompress: false,
      signal: options.signal,
    });
    return asyncBufferFromBytes(whole.bytes);
  }
  const byteLength = probe.contentLength;
  return {
    byteLength,
    slice: async (start, end) => {
      const stop = Math.min(end ?? byteLength, byteLength);
      const result = await downloadBounded(http, url, {
        maxBytes: options.maxBytes,
        decompress: false,
        signal: options.signal,
        range: { start, end: stop - 1 },
      });
      // Servers that ignore Range answer 200 with the whole body: slice locally.
      const bytes = result.partial ? result.bytes : result.bytes.subarray(start, stop);
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

export async function readParquetMetadata(file: AsyncBuffer): Promise<FileMetaData> {
  try {
    return await parquetMetadataAsync(file);
  } catch (error) {
    throw new FormatError(
      `Not a readable Parquet file: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error, hint: "Check that the URL serves a Parquet file (magic bytes PAR1)." },
    );
  }
}

function mapType(node: SchemaTree): { type: ColumnType; native: string } {
  const el = node.element;
  const logical = el.logical_type?.type;
  const converted = el.converted_type;
  const physical = el.type ?? "GROUP";
  const native = logical ?? converted ?? physical;
  if (node.children.length > 0) {
    const isList = converted === "LIST" || logical === "LIST";
    return { type: isList ? "json" : "json", native: isList ? "LIST" : "STRUCT" };
  }
  if (logical === "GEOMETRY" || logical === "GEOGRAPHY") return { type: "geometry", native };
  if (logical === "STRING" || converted === "UTF8" || converted === "ENUM") {
    return { type: "string", native };
  }
  if (logical === "DATE" || converted === "DATE") return { type: "date", native };
  if (
    logical === "TIMESTAMP" ||
    converted === "TIMESTAMP_MILLIS" ||
    converted === "TIMESTAMP_MICROS"
  ) {
    return { type: "datetime", native };
  }
  if (logical === "JSON" || converted === "JSON") return { type: "json", native };
  if (logical === "DECIMAL" || converted === "DECIMAL") return { type: "number", native };
  switch (physical) {
    case "BOOLEAN":
      return { type: "boolean", native };
    case "INT32":
    case "INT64":
      return { type: "integer", native };
    case "FLOAT":
    case "DOUBLE":
      return { type: "number", native };
    case "BYTE_ARRAY":
    case "FIXED_LEN_BYTE_ARRAY":
      return {
        type: converted === undefined && logical === undefined ? "string" : "string",
        native,
      };
    default:
      return { type: "unknown", native };
  }
}

export function schemaFromMetadata(metadata: FileMetaData): TableSchema {
  const tree = parquetSchema(metadata);
  const columns: ColumnSchema[] = tree.children.map((child) => {
    const { type, native } = mapType(child);
    const stats: Record<string, unknown> = {};
    let nullCount = 0n;
    let hasNullStats = false;
    for (const group of metadata.row_groups) {
      const chunk = group.columns.find(
        (c) => c.meta_data?.path_in_schema[0] === child.element.name,
      );
      const s = chunk?.meta_data?.statistics;
      if (s?.null_count !== undefined) {
        hasNullStats = true;
        nullCount += s.null_count;
      }
    }
    if (hasNullStats && metadata.num_rows > 0n) {
      stats.nullRatio = Math.round((Number(nullCount) / Number(metadata.num_rows)) * 1000) / 1000;
    }
    return {
      name: child.element.name,
      type,
      nativeType: native,
      nullable: child.element.repetition_type !== "REQUIRED",
      stats,
    };
  });
  return { columns, rowCount: Number(metadata.num_rows), source: "parquet" };
}

function normaliseValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
  return value;
}

export async function readParquetRows(
  file: AsyncBuffer,
  metadata: FileMetaData,
  options: { columns?: string[]; rowStart?: number; rowEnd?: number },
): Promise<Row[]> {
  let rows: Record<string, unknown>[];
  try {
    rows = await parquetReadObjects({
      file,
      metadata,
      columns: options.columns,
      rowStart: options.rowStart,
      rowEnd: options.rowEnd,
      compressors,
    });
  } catch (error) {
    throw new FormatError(
      `Could not decode Parquet rows: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) out[k] = normaliseValue(v);
    return out;
  });
}
