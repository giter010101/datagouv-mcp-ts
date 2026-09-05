import type { TabularFilter, TabularSort } from "../../clients/types.js";
import { ValidationError } from "../../core/errors.js";
import type { Row, TableSlice } from "../../core/types.js";
import { columnNames, isNullish } from "../infer.js";
import type { AggregationSpec, QuerySpec } from "../types.js";

/**
 * In-memory query execution with the Tabular API vocabulary
 * (exact / differs / contains / in / less / greater / strictly_less /
 * strictly_greater, multi-column sort, group-by aggregations, pagination).
 * Every stream-parsing accessor and the pure-JS engine share this code so all
 * paths behave identically.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (t === "" || !/^[+-]?(\d+([.,]\d+)?|\d*[.,]\d+)([eE][+-]?\d+)?$/.test(t)) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** -1 / 0 / 1 with numeric awareness; nulls sort last. */
export function compareValues(a: unknown, b: unknown): number {
  const aNull = isNullish(a);
  const bNull = isNullish(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== undefined && nb !== undefined) return na < nb ? -1 : na > nb ? 1 : 0;
  const sa = toText(a);
  const sb = toText(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function equals(a: unknown, b: string): boolean {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== undefined && nb !== undefined) return na === nb;
  return toText(a) === b;
}

export function matchesFilter(row: Row, filter: TabularFilter): boolean {
  const value = row[filter.column];
  switch (filter.operator) {
    case "exact":
      return equals(value, filter.value);
    case "differs":
      return !equals(value, filter.value);
    case "contains":
      return toText(value).toLowerCase().includes(filter.value.toLowerCase());
    case "in":
      return filter.value.split(",").some((v) => equals(value, v.trim()));
    case "less":
      return !isNullish(value) && compareValues(value, filter.value) <= 0;
    case "greater":
      return !isNullish(value) && compareValues(value, filter.value) >= 0;
    case "strictly_less":
      return !isNullish(value) && compareValues(value, filter.value) < 0;
    case "strictly_greater":
      return !isNullish(value) && compareValues(value, filter.value) > 0;
    default:
      throw new ValidationError(`Unknown filter operator "${String(filter.operator)}"`, {
        hint: "Use one of exact, differs, contains, in, less, greater, strictly_less, strictly_greater.",
      });
  }
}

export function applyFilters(rows: Row[], filters: TabularFilter[] | undefined): Row[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f)));
}

export function applySort(rows: Row[], sort: TabularSort[] | undefined): Row[] {
  if (!sort || sort.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const cmp = compareValues(a[s.column], b[s.column]);
      if (cmp !== 0) return s.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

export function aggregationColumnName(metric: AggregationSpec["metrics"][number]): string {
  if (metric.op === "count") return metric.column ? `${metric.column}__count` : "count";
  return `${metric.column ?? "*"}__${metric.op}`;
}

export function applyAggregation(rows: Row[], spec: AggregationSpec): Row[] {
  for (const metric of spec.metrics) {
    if (metric.op !== "count" && !metric.column) {
      throw new ValidationError(`Aggregation "${metric.op}" requires a column`, {
        hint: 'Provide { op: "sum", column: "montant" }.',
      });
    }
  }
  const groups = new Map<string, { key: Row; values: Row[] }>();
  for (const row of rows) {
    const key: Row = {};
    for (const col of spec.groupBy) key[col] = row[col] ?? null;
    const id = JSON.stringify(spec.groupBy.map((c) => key[c]));
    const group = groups.get(id) ?? { key, values: [] };
    group.values.push(row);
    groups.set(id, group);
  }
  const out: Row[] = [];
  for (const { key, values } of groups.values()) {
    const result: Row = { ...key };
    for (const metric of spec.metrics) {
      const name = aggregationColumnName(metric);
      if (metric.op === "count") {
        result[name] = metric.column
          ? values.filter((r) => !isNullish(r[metric.column ?? ""])).length
          : values.length;
        continue;
      }
      const column = metric.column ?? "";
      const nums = values
        .map((r) => toNumber(r[column]))
        .filter((n): n is number => n !== undefined);
      if (nums.length === 0) {
        result[name] = null;
        continue;
      }
      switch (metric.op) {
        case "sum":
          result[name] = nums.reduce((s, n) => s + n, 0);
          break;
        case "avg":
          result[name] = nums.reduce((s, n) => s + n, 0) / nums.length;
          break;
        case "min":
          result[name] = Math.min(...nums);
          break;
        case "max":
          result[name] = Math.max(...nums);
          break;
        default:
          break;
      }
    }
    out.push(result);
  }
  return out;
}

export function normalizePage(spec: QuerySpec): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(spec.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(spec.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  return { page, pageSize };
}

export function projectColumns(rows: Row[], columns: string[] | undefined): Row[] {
  if (!columns || columns.length === 0) return rows;
  return rows.map((row) => {
    const out: Row = {};
    for (const c of columns) out[c] = row[c];
    return out;
  });
}

export interface ApplyQueryOptions {
  /** True when `rows` is the complete table (else `total` is a lower bound and `truncated` is set). */
  complete?: boolean;
  /** Column order to use when rows are empty or sparse. */
  columns?: string[];
}

/** Full pipeline: filters → aggregation → sort → pagination → projection. */
export function applyQuery(
  rows: Row[],
  spec: QuerySpec,
  options: ApplyQueryOptions = {},
): TableSlice {
  const filtered = applyFilters(rows, spec.filters);
  const aggregated = spec.aggregate ? applyAggregation(filtered, spec.aggregate) : filtered;
  const sorted = applySort(aggregated, spec.sort);
  const { page, pageSize } = normalizePage(spec);
  const start = (page - 1) * pageSize;
  const pageRows = projectColumns(sorted.slice(start, start + pageSize), spec.columns);
  const allColumns =
    spec.columns && spec.columns.length > 0
      ? spec.columns
      : spec.aggregate
        ? columnNames(aggregated.slice(0, 1))
        : (options.columns ?? columnNames(rows));
  return {
    columns: allColumns,
    rows: pageRows,
    total: sorted.length,
    page,
    pageSize,
    hasNext: start + pageSize < sorted.length,
    truncated: options.complete === false,
  };
}
