import { formatBytes, truncate } from "../../core/text.js";
import type { Row, TableSchema, TableSlice } from "../../core/types.js";

/** Output shaping constants (ADR 0008). */
export const LIST_DESCRIPTION_CHARS = 200;
export const DETAIL_DESCRIPTION_CHARS = 500;
export const LIST_TAGS_MAX = 5;
export const DETAIL_TAGS_MAX = 10;
export const CELL_MAX_CHARS = 100;
export const MAX_ROWS_PER_CALL = 200;

/** Legacy-compatible "human size" (`filesize` of 0/undefined → omitted by callers). */
export function humanSize(bytes: number | undefined): string | undefined {
  return bytes === undefined ? undefined : formatBytes(bytes);
}

/** `Key: value` line, skipped when the value is empty. */
export function kv(key: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.length === 0 ? undefined : `${key}: ${value.join(", ")}`;
  return `${key}: ${String(value)}`;
}

/** Join lines, dropping `undefined` entries (from `kv`). */
export function lines(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => p !== undefined).join("\n");
}

/** Convert a cell to display text, bounded to `CELL_MAX_CHARS` like the legacy server. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return truncate(text, CELL_MAX_CHARS);
}

/** Legacy `Row N:` layout used by `query_resource_data`. */
export function renderRowsLegacy(rows: Row[]): string[] {
  const out: string[] = [rows.length === 1 ? "Data (1 row):" : `Data (${rows.length} rows):`];
  rows.forEach((row, index) => {
    out.push(`  Row ${index + 1}:`);
    for (const [key, value] of Object.entries(row)) out.push(`    ${key}: ${cellText(value)}`);
  });
  return out;
}

/** Compact ASCII table (header + `|`-separated rows). Used by the new data tools. */
export function renderTable(slice: TableSlice): string[] {
  if (slice.rows.length === 0) return ["(no rows)"];
  const columns =
    slice.columns.length > 0 ? slice.columns : Object.keys(slice.rows[0] ?? {}).map(String);
  const out = [
    columns.join(" | "),
    columns.map((c) => "-".repeat(Math.min(c.length, 20))).join("-|-"),
  ];
  for (const row of slice.rows) out.push(columns.map((c) => cellText(row[c])).join(" | "));
  return out;
}

export function renderSchema(schema: TableSchema): string[] {
  const out = [
    `Columns (${schema.columns.length}, source: ${schema.source})${
      schema.rowCount !== undefined ? ` — rows: ${schema.rowCount}` : ""
    }:`,
  ];
  for (const column of schema.columns) {
    const native =
      column.nativeType && column.nativeType !== column.type ? ` [${column.nativeType}]` : "";
    out.push(`  - ${column.name}: ${column.type}${native}`);
  }
  return out;
}

export function paginationLine(page: number, hasNext: boolean): string | undefined {
  return hasNext ? `More results available: use page=${page + 1}.` : undefined;
}

export function pageStructured(info: {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}) {
  return { total: info.total, page: info.page, page_size: info.pageSize, has_next: info.hasNext };
}
