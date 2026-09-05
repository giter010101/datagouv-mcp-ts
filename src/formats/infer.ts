import type { ColumnSchema, ColumnType, Row, TableSchema } from "../core/types.js";

/**
 * Schema inference from sample rows: column types, null ratio, sample values,
 * numeric min/max. Cheap and deterministic; used by every stream-parsing
 * accessor when no upstream profile exists.
 */

export interface InferOptions {
  /** Rows used for inference (default: all given rows). */
  sampleSize?: number;
  /** Total row count when known (else `rows.length` if `complete`). */
  rowCount?: number;
  /** True when `rows` is the whole table (row count is exact). */
  complete?: boolean;
  sampleValues?: number;
}

const INT_RE = /^[+-]?\d{1,18}$/;
const NUM_RE = /^[+-]?(\d+([.,]\d+)?|\d*[.,]\d+)([eE][+-]?\d+)?$/;
const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const BOOL_VALUES = new Set(["true", "false", "vrai", "faux", "oui", "non", "yes", "no"]);

export function isNullish(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" || t === "NA" || t === "N/A" || t === "null" || t === "NULL" || t === "-";
  }
  return false;
}

/** Type of a single non-null value. */
export function classifyValue(value: unknown): ColumnType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "bigint") return "integer";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (value instanceof Date) return "datetime";
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.type === "string" && "coordinates" in rec) return "geometry";
    return "json";
  }
  if (typeof value !== "string") return "unknown";
  const t = value.trim();
  if (INT_RE.test(t)) return "integer";
  if (NUM_RE.test(t)) return "number";
  if (BOOL_VALUES.has(t.toLowerCase())) return "boolean";
  if (DATE_RE.test(t)) return "date";
  if (DATETIME_RE.test(t)) return "datetime";
  return "string";
}

/** Widen two observed types to a common type. */
export function mergeTypes(a: ColumnType | undefined, b: ColumnType): ColumnType {
  if (a === undefined || a === b) return b;
  if (a === "unknown") return b;
  if (b === "unknown") return a;
  const pair = new Set([a, b]);
  if (pair.has("integer") && pair.has("number")) return "number";
  if (pair.has("date") && pair.has("datetime")) return "datetime";
  return "string";
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return undefined;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function columnNames(rows: Row[], limit = 500): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, limit)) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }
  return names;
}

export function inferSchema(rows: Row[], options: InferOptions = {}): TableSchema {
  const sample = rows.slice(0, options.sampleSize ?? rows.length);
  const names = columnNames(sample);
  const maxSamples = options.sampleValues ?? 3;
  const columns: ColumnSchema[] = names.map((name) => {
    let type: ColumnType | undefined;
    let nulls = 0;
    let min: number | undefined;
    let max: number | undefined;
    const samples: unknown[] = [];
    const seenSamples = new Set<string>();
    for (const row of sample) {
      const value = row[name];
      if (isNullish(value)) {
        nulls++;
        continue;
      }
      type = mergeTypes(type, classifyValue(value));
      if (samples.length < maxSamples) {
        const key = typeof value === "object" ? JSON.stringify(value) : String(value);
        if (!seenSamples.has(key)) {
          seenSamples.add(key);
          samples.push(typeof value === "object" && value !== null ? key.slice(0, 80) : value);
        }
      }
      if (type === "integer" || type === "number") {
        const n = toNumber(value);
        if (n !== undefined) {
          min = min === undefined ? n : Math.min(min, n);
          max = max === undefined ? n : Math.max(max, n);
        }
      }
    }
    const finalType: ColumnType = type ?? "unknown";
    const stats: Record<string, unknown> = {
      nullRatio: sample.length === 0 ? 0 : Math.round((nulls / sample.length) * 1000) / 1000,
      sampleValues: samples,
    };
    if ((finalType === "integer" || finalType === "number") && min !== undefined) {
      stats.min = min;
      stats.max = max;
    }
    return { name, type: finalType, nativeType: undefined, nullable: nulls > 0, stats };
  });
  return {
    columns,
    rowCount: options.rowCount ?? (options.complete ? rows.length : undefined),
    source: "inferred",
  };
}

/** Coerce string cells to typed values according to an inferred schema (for filters/sort/aggregates). */
export function coerceRows(rows: Row[], schema: TableSchema): Row[] {
  const numeric = new Set(
    schema.columns.filter((c) => c.type === "integer" || c.type === "number").map((c) => c.name),
  );
  if (numeric.size === 0) return rows;
  return rows.map((row) => {
    const out: Row = { ...row };
    for (const name of numeric) {
      const value = out[name];
      if (typeof value === "string") {
        const n = toNumber(value);
        if (n !== undefined && !isNullish(value)) out[name] = n;
      }
    }
    return out;
  });
}
