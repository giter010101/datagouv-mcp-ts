# 0006: Pluggable `QueryEngine` — DuckDB optional, pure-JS fallback always present

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

Users want analytical questions over big CSV/Parquet files (12.7M-row radar dataset, Hydra Parquet conversions for 19,820 resources). `@duckdb/node-api` gives full SQL over remote CSV/Parquet/JSON via `httpfs` but is a 50–80 MB platform-specific native binary with cold-start cost; it cannot be a hard dependency of an `npx`-able server. Format-specific parsers (`csv-parse`, `hyparquet`, `exceljs`) cover preview/schema and filtered pagination with strict caps.

## Decision

- `src/formats/types.ts` defines `QueryEngine { id, isAvailable(), queryUrl(url, format, spec), describeUrl(url, format) }` and `QuerySpec` (filters/sort/columns/page/pageSize, optional `sql`).
- Two engines, selected at startup by `createDeps`:
  - **`duckdb`** (`src/formats/engines/duckdb.ts`): enabled only when `ENABLE_DUCKDB=1` **and** `@duckdb/node-api` resolves (`await import()` in a try/catch). `@duckdb/node-api` is an **`optionalDependencies`** entry, never imported statically. Read-only: `SET enable_external_access` scoped to http(s) URLs of `*.data.gouv.fr` / Hydra buckets, `PRAGMA threads` capped, statement timeout, memory limit from config. Any `sql` from the LLM must be a **single `SELECT`/`WITH`** (validated by the tools layer; no DDL/COPY/ATTACH/INSTALL).
  - **`pure-js`** (`src/formats/engines/pure-js.ts`): bounded download (`MAX_DOWNLOAD_BYTES`, gzip aware) → streaming parser → in-memory filter/sort/project/paginate. Always available; also the fallback when DuckDB errors. Rejects `sql` with `ENGINE_UNAVAILABLE` and a hint to use filters.
- Accessors receive the engine through `AccessContext`/deps; tools never import an engine directly.
- Tabular API remains the **first** choice whenever the resource is indexed (capability `tabular_api`): no download, server-side filtering.

## Consequences

### Positive
- Default install stays light and portable; power users/ops opt in to SQL.
- Same `QuerySpec` vocabulary for all paths → one `query_resource` tool.

### Negative
- Two code paths to keep behaviourally aligned (shared spec tests in workstream B).
- Docker image with DuckDB needs a glibc base (`node:22-slim`), not Alpine — decision deferred to E/B.

### Neutral
- DuckDB-WASM rejected for 1.0 (bundling complexity, memory limits); can implement `QueryEngine` later.
