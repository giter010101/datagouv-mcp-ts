import type { HttpClient } from "../../core/http.js";
import type { EngineSelectionHints, EngineSet, QueryEngine } from "../types.js";
import { createDuckdbEngine, DUCKDB_FORMATS, type DuckdbLoader } from "./duckdb.js";
import { createPureJsEngine } from "./pure-js.js";

export * from "./duckdb.js";
export * from "./pure-js.js";
export * from "./query.js";
export * from "./sql-guard.js";

export interface CreateEnginesOptions {
  http: HttpClient;
  maxDownloadBytes: number;
  /** `ENABLE_DUCKDB` — when false the DuckDB engine is never loaded. */
  enableDuckdb: boolean;
  /** Files above this size go to DuckDB when available (default 8 MB). */
  duckdbThresholdBytes?: number;
  duckdbLoader?: DuckdbLoader;
  duckdbMemoryLimit?: string;
}

/**
 * Engine factory: pure-js always; DuckDB when enabled + installed. Selection
 * per query: `sql` → DuckDB (or ENGINE_UNAVAILABLE from pure-js), parquet or
 * large files → DuckDB when available, otherwise pure-js.
 */
export function createEngines(options: CreateEnginesOptions): EngineSet {
  const pureJs = createPureJsEngine(options);
  const duckdb: QueryEngine | undefined = options.enableDuckdb
    ? createDuckdbEngine({
        http: options.http,
        maxDownloadBytes: options.maxDownloadBytes,
        loader: options.duckdbLoader,
        memoryLimit: options.duckdbMemoryLimit,
      })
    : undefined;
  const threshold = options.duckdbThresholdBytes ?? 8 * 1024 * 1024;
  let availability: Promise<boolean> | undefined;
  const duckdbAvailable = () => {
    if (!duckdb) return Promise.resolve(false);
    availability ??= duckdb.isAvailable().catch(() => false);
    return availability;
  };
  return {
    pureJs,
    duckdb,
    async select(hints: EngineSelectionHints): Promise<QueryEngine> {
      if (!duckdb || !DUCKDB_FORMATS.has(hints.format)) return pureJs;
      if (!(await duckdbAvailable())) return pureJs;
      if (hints.sql) return duckdb;
      if (hints.format === "parquet") return duckdb;
      if (hints.sizeBytes !== undefined && hints.sizeBytes >= threshold) return duckdb;
      return pureJs;
    },
  };
}
