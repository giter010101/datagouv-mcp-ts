import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TabularFilter, TabularSort } from "../../clients/types.js";
import { EngineUnavailableError, FormatError, ValidationError } from "../../core/errors.js";
import type { HttpClient } from "../../core/http.js";
import type { ColumnType, Row, TableSchema, TableSlice } from "../../core/types.js";
import { downloadBounded } from "../download.js";
import type { AggregationSpec, QueryEngine, QuerySpec } from "../types.js";
import { aggregationColumnName, normalizePage } from "./query.js";
import { guardReadOnlySql } from "./sql-guard.js";

/**
 * Optional DuckDB engine (ADR 0006). `@duckdb/node-api` is loaded lazily with a
 * dynamic import so the package may be absent. Files are downloaded (bounded)
 * to a temp file, loaded into an in-memory database, then external access is
 * disabled before any user-provided SQL runs.
 */

interface DuckdbReader {
  getRowObjectsJson(): Record<string, unknown>[];
  columnNames(): string[];
  columnTypes(): Array<{ toString(): string }>;
}
interface DuckdbConnection {
  run(sql: string): Promise<unknown>;
  runAndReadAll(sql: string): Promise<DuckdbReader>;
  closeSync?(): void;
  disconnectSync?(): void;
}
interface DuckdbInstance {
  connect(): Promise<DuckdbConnection>;
  closeSync?(): void;
}
export interface DuckdbModule {
  DuckDBInstance: {
    create(path: string, options?: Record<string, string>): Promise<DuckdbInstance>;
  };
}

export type DuckdbLoader = () => Promise<DuckdbModule>;

const DUCKDB_PACKAGE = "@duckdb/node-api";

export const defaultDuckdbLoader: DuckdbLoader = async () => {
  // Variable specifier: bundlers must not try to resolve the optional package.
  const specifier = DUCKDB_PACKAGE;
  return (await import(specifier)) as DuckdbModule;
};

export interface DuckdbEngineOptions {
  http: HttpClient;
  maxDownloadBytes: number;
  memoryLimit?: string;
  threads?: number;
  loader?: DuckdbLoader;
}

export const DUCKDB_FORMATS: ReadonlySet<string> = new Set([
  "csv",
  "tsv",
  "txt",
  "parquet",
  "json",
  "jsonl",
]);

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export function filterToSql(filter: TabularFilter): string {
  const col = quoteIdent(filter.column);
  const lit = quoteLiteral(filter.value);
  switch (filter.operator) {
    case "exact":
      return `${col} = ${lit}`;
    case "differs":
      return `(${col} IS NULL OR ${col} <> ${lit})`;
    case "contains":
      return `CAST(${col} AS VARCHAR) ILIKE ${quoteLiteral(likePattern(filter.value))} ESCAPE '\\'`;
    case "in":
      return `${col} IN (${filter.value
        .split(",")
        .map((v) => quoteLiteral(v.trim()))
        .join(", ")})`;
    case "less":
      return `${col} <= ${lit}`;
    case "greater":
      return `${col} >= ${lit}`;
    case "strictly_less":
      return `${col} < ${lit}`;
    case "strictly_greater":
      return `${col} > ${lit}`;
    default:
      throw new ValidationError(`Unknown filter operator "${String(filter.operator)}"`);
  }
}

function sortToSql(sort: TabularSort[]): string {
  return sort
    .map((s) => `${quoteIdent(s.column)} ${s.direction === "desc" ? "DESC" : "ASC"} NULLS LAST`)
    .join(", ");
}

function aggregateSelect(spec: AggregationSpec): string {
  const parts = spec.groupBy.map(quoteIdent);
  for (const metric of spec.metrics) {
    const name = quoteIdent(aggregationColumnName(metric));
    if (metric.op === "count") {
      parts.push(
        metric.column ? `count(${quoteIdent(metric.column)}) AS ${name}` : `count(*) AS ${name}`,
      );
    } else {
      if (!metric.column) throw new ValidationError(`Aggregation "${metric.op}" requires a column`);
      parts.push(`${metric.op}(TRY_CAST(${quoteIdent(metric.column)} AS DOUBLE)) AS ${name}`);
    }
  }
  return parts.join(", ");
}

/** Build the base (unpaginated) SELECT for a `QuerySpec` over table `data`. */
export function specToSql(spec: QuerySpec): string {
  const where =
    spec.filters && spec.filters.length > 0
      ? ` WHERE ${spec.filters.map(filterToSql).join(" AND ")}`
      : "";
  let sql: string;
  if (spec.aggregate) {
    const groupBy =
      spec.aggregate.groupBy.length > 0
        ? ` GROUP BY ${spec.aggregate.groupBy.map(quoteIdent).join(", ")}`
        : "";
    sql = `SELECT ${aggregateSelect(spec.aggregate)} FROM data${where}${groupBy}`;
  } else {
    const select =
      spec.columns && spec.columns.length > 0 ? spec.columns.map(quoteIdent).join(", ") : "*";
    sql = `SELECT ${select} FROM data${where}`;
  }
  if (spec.sort && spec.sort.length > 0) sql += ` ORDER BY ${sortToSql(spec.sort)}`;
  return sql;
}

function readerFunction(format: string, path: string): string {
  const p = quoteLiteral(path);
  switch (format) {
    case "csv":
    case "txt":
      return `read_csv_auto(${p}, ignore_errors = true, header = true)`;
    case "tsv":
      return `read_csv_auto(${p}, delim = '\t', ignore_errors = true, header = true)`;
    case "parquet":
      return `read_parquet(${p})`;
    case "json":
    case "jsonl":
      return `read_json_auto(${p}, ignore_errors = true, maximum_object_size = 33554432)`;
    default:
      throw new EngineUnavailableError(`DuckDB engine does not read "${format}" files here`, {
        hint: `Supported: ${[...DUCKDB_FORMATS].join(", ")}.`,
      });
  }
}

const NUMERIC_TYPES =
  /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|UHUGEINT|DECIMAL|DOUBLE|FLOAT|REAL)/i;

export function duckdbTypeToColumnType(type: string): ColumnType {
  const t = type.toUpperCase();
  if (/^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|U(TINY|SMALL|BIG|HUGE)?INT)/.test(t))
    return "integer";
  if (/^(DECIMAL|DOUBLE|FLOAT|REAL)/.test(t)) return "number";
  if (t === "BOOLEAN") return "boolean";
  if (t === "DATE") return "date";
  if (t.startsWith("TIMESTAMP")) return "datetime";
  if (t.startsWith("STRUCT") || t.startsWith("MAP") || t.endsWith("[]") || t === "JSON")
    return "json";
  if (t === "GEOMETRY" || t === "WKB_BLOB") return "geometry";
  if (t.startsWith("VARCHAR") || t === "UUID" || t.startsWith("ENUM")) return "string";
  return "unknown";
}

function normaliseRows(reader: DuckdbReader): { rows: Row[]; columns: string[] } {
  const columns = reader.columnNames();
  const types = reader.columnTypes().map((t) => t.toString());
  const rows = reader.getRowObjectsJson().map((raw) => {
    const row: Row = {};
    columns.forEach((name, i) => {
      const value = raw[name];
      const type = types[i] ?? "";
      if (typeof value === "string" && NUMERIC_TYPES.test(type)) {
        const n = Number(value);
        row[name] =
          Number.isSafeInteger(n) || (!Number.isInteger(n) && Number.isFinite(n)) ? n : value;
      } else {
        row[name] = value === undefined ? null : value;
      }
    });
    return row;
  });
  return { rows, columns };
}

export function createDuckdbEngine(options: DuckdbEngineOptions): QueryEngine {
  const loader = options.loader ?? defaultDuckdbLoader;
  let modulePromise: Promise<DuckdbModule | undefined> | undefined;
  const load = () => {
    modulePromise ??= loader().catch(() => undefined);
    return modulePromise;
  };

  async function withTable<T>(
    url: string,
    format: string,
    signal: AbortSignal | undefined,
    fn: (conn: DuckdbConnection) => Promise<T>,
  ): Promise<T> {
    const mod = await load();
    if (!mod) {
      throw new EngineUnavailableError("DuckDB engine is not installed", {
        hint: "Install the optional dependency @duckdb/node-api and set ENABLE_DUCKDB=1, or use filters instead of sql.",
      });
    }
    const reader = readerFunction(format, "__placeholder__");
    const download = await downloadBounded(options.http, url, {
      maxBytes: options.maxDownloadBytes,
      signal,
      onOverflow: "throw",
    });
    const dir = await mkdtemp(join(tmpdir(), "datagouv-mcp-duckdb-"));
    const path = join(dir, `${randomUUID()}.${format === "tsv" ? "csv" : format}`);
    let instance: DuckdbInstance | undefined;
    let conn: DuckdbConnection | undefined;
    try {
      await writeFile(path, download.bytes);
      instance = await mod.DuckDBInstance.create(":memory:", {
        memory_limit: options.memoryLimit ?? "512MB",
        threads: String(options.threads ?? 2),
      });
      conn = await instance.connect();
      try {
        await conn.run(
          `CREATE TABLE data AS SELECT * FROM ${reader.replace("'__placeholder__'", quoteLiteral(path))}`,
        );
      } catch (error) {
        throw new FormatError(
          `DuckDB could not read the file as ${format}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
          {
            cause: error,
            hint: "Check the declared format; try preview_resource to see the raw content.",
          },
        );
      }
      await conn.run("SET enable_external_access = false");
      return await fn(conn);
    } finally {
      conn?.closeSync?.();
      instance?.closeSync?.();
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async function runUser(conn: DuckdbConnection, sql: string): Promise<DuckdbReader> {
    try {
      return await conn.runAndReadAll(sql);
    } catch (error) {
      throw new ValidationError(
        `SQL error: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
        {
          cause: error,
          hint: 'The file is exposed as table "data"; check column names with get_resource_schema.',
        },
      );
    }
  }

  return {
    id: "duckdb",
    isAvailable: async () => (await load()) !== undefined,
    async queryUrl(url, format, spec, signal): Promise<TableSlice> {
      const { page, pageSize } = normalizePage(spec);
      const offset = (page - 1) * pageSize;
      return withTable(url, format, signal, async (conn) => {
        const base = spec.sql !== undefined ? guardReadOnlySql(spec.sql).sql : specToSql(spec);
        const totalReader = await runUser(conn, `SELECT count(*) AS n FROM (${base}) AS __c`);
        const total = Number(totalReader.getRowObjectsJson()[0]?.n ?? 0);
        const reader = await runUser(
          conn,
          `SELECT * FROM (${base}) AS __q LIMIT ${pageSize} OFFSET ${offset}`,
        );
        const { rows, columns } = normaliseRows(reader);
        return {
          columns,
          rows,
          total,
          page,
          pageSize,
          hasNext: offset + pageSize < total,
          truncated: false,
        };
      });
    },
    async describeUrl(url, format, signal): Promise<TableSchema> {
      return withTable(url, format, signal, async (conn) => {
        const describe = await conn.runAndReadAll("DESCRIBE data");
        const count = await conn.runAndReadAll("SELECT count(*) AS n FROM data");
        const rowCount = Number(count.getRowObjectsJson()[0]?.n ?? 0);
        const columns = describe.getRowObjectsJson().map((r) => {
          const native = String(r.column_type ?? "");
          return {
            name: String(r.column_name ?? ""),
            type: duckdbTypeToColumnType(native),
            nativeType: native,
            nullable: r.null === "YES" ? true : r.null === "NO" ? false : undefined,
            stats: undefined,
          };
        });
        return { columns, rowCount, source: "inferred" };
      });
    },
  };
}
