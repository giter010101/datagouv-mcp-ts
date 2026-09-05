# Exec Plan 001: TypeScript rewrite of the data.gouv.fr MCP server

**Status**: active
**Owner**: architect (plan) · orchestrator (workstream dispatch)
**Created**: 2026-09-03
**Updated**: 2026-09-03 (tracking refresh post completion-audit-2)
**Inputs**: `research/01`–`04`, ADRs `decisions/0001`–`0010`, draft PR [#1](https://github.com/giter010101/datagouv-mcp-ts/pull/1)

## Goal

Ship `datagouv-mcp` 1.0.0: a TypeScript MCP server that lets LLM clients search, inspect, preview and query **any** dataset/resource on data.gouv.fr, whatever its format, fluently, quickly and without protocol-level errors — with full parity with the 10 legacy Python tools plus a unified, capability-driven data-access layer.

## Scope

- Package at repo root (`package.json` name `datagouv-mcp`, bin `datagouv-mcp`), Node 22, strict ESM (ADR 0001, 0002).
- Transports: stdio (default) and stateless Streamable HTTP `/mcp` + `/health` (ADR 0003).
- All 10 legacy tools with identical names/params/semantics (ADR 0007) + new tools listed in §4.
- Formats layer with capability detection and `ResourceAccessor`s for Tier 1–3 formats (§5), optional DuckDB engine (ADR 0006).
- Caching, retries, error taxonomy, output shaping (ADR 0008, 0009), observability (§9).
- Test pyramid + evidence reports (ADR 0010), CI, Docker, README.

## Non-goals

- Write operations on data.gouv.fr (uploads, discussions): server stays read-only, unauthenticated.
- Reintroducing `download_and_parse_resource` as-is (removed in 0.2.20 for RAM/security): replaced by bounded `preview_resource`/`query_resource`.
- OAuth / multi-tenant auth (design hook only, no implementation in 1.0).
- MCP SDK v2 migration (tracked as tech debt; stay on 1.x stable).
- Full-text indexing or local copies of the catalogue.

## 1. Target architecture

### 1.1 Module map

```
src/
├── index.ts                CLI: --http / --stdio / MCP_TRANSPORT, --help, --version
├── core/                   no upward imports
│   ├── config.ts           Zod env → Config (legacy var names), ApiBaseUrls prod/demo
│   ├── errors.ts           DatagouvError hierarchy (§6)
│   ├── logger.ts           pino → stderr, childLogger(module)
│   ├── cache.ts            Cache interface, LruCache (TTL, in-flight dedupe, stale-on-error)
│   ├── http.ts             HttpClient over fetch: timeout, retries, Retry-After, bounded body, Zod
│   ├── text.ts             truncate / formatBytes / capOutput
│   ├── types.ts            DatasetSummary, ResourceDetail, TableSchema, TableSlice, Page<T>…
│   └── version.ts          APP_VERSION, USER_AGENT
├── clients/                one file per upstream service; Zod schemas in schemas/
│   ├── types.ts            DatagouvClient, TabularClient, MetricsClient, CrawlerClient, SchemaClient, Clients
│   ├── datagouv-client.ts  ✅ searchDatasets (rest: workstream A)
│   ├── tabular-client.ts   (A)
│   ├── metrics-client.ts   (A)
│   ├── crawler-client.ts   (A)
│   ├── schema-client.ts    (A) schema.data.gouv.fr + Validata
│   └── schemas/*.ts        Zod for raw API payloads (loose objects)
├── formats/                capability detection + accessors (workstream B)
│   ├── types.ts            ResourceCapability, CapabilityReport, ResourceAccessor, QueryEngine, QuerySpec
│   ├── registry.ts         ✅ AccessorRegistry (resolve by capability order)
│   ├── capability.ts       detectCapability(resource, deps) — algorithm §5
│   ├── accessors/          tabular-api, csv-stream, spreadsheet, json, geojson, parquet, archive, document, api-endpoint, metadata
│   ├── engines/            duckdb (optional), pure-js fallback
│   └── download.ts         bounded fetch (gzip, size caps, content sniffing)
├── tools/                  thin handlers (workstream C)
│   ├── types.ts            ToolDefinition, ToolContext, ToolResult, defineTool
│   ├── registry.ts         ✅ SDK adapter: logging, error→isError, output cap
│   ├── shared/             annotations, search-query, formatters
│   ├── <tool-name>.ts      one file per tool (§4)
│   └── index.ts            ALL_TOOLS (legacy order first), ToolDeps
└── server/                 composition + transports (workstream C)
    ├── deps.ts             createDeps(config) → ServerDeps (http, cache, clients, formats, config)
    ├── mcp-server.ts       createMcpServer(deps) — registers ALL_TOOLS, instructions
    ├── stdio.ts            runStdio
    ├── http.ts             Hono app: /mcp (stateless), /health, host/origin guard, runHttp
    └── telemetry/          matomo.ts, sentry.ts (optional, env-gated)
tests/  unit · contract fixtures · e2e (in-memory + HTTP loopback) · live (env-gated)
scripts/ check-layers.ts · evidence.ts
docs/   evidence/ (generated) · deployment · client configs
```

### 1.2 Data flow — "find dataset → pick resource → detect capability → query data"

```
LLM ──search_datasets(q)──▶ tools/search-datasets ─▶ clients.datagouv.searchDatasets
                                                      └─ core/http GET /api/2/datasets/search/ (cache 60s)
    ◀── text + structuredContent{datasets[]} ─────────┘

LLM ──list_dataset_resources(dataset_id)──▶ clients.datagouv.getDataset (v1, cache 5min)
    ◀── resources[] each with {id, format, size, type, filetype, hint: best capability (offline detection)}

LLM ──get_resource_info(resource_id)──▶ clients.datagouv.getResource (v2 → ResourceDetail incl. extras/analysis)
                                        └─▶ formats.detectCapability(resource, {probeTabular, crawlerExceptions})
                                              ├─ tabular.getProfile (only when metadata says maybe)
                                              └─ crawler.getResourceExceptions (cache 1h, stale-on-error)
    ◀── CapabilityReport{primary, capabilities[], urls, warnings, reasons} + "next tool to call"

LLM ──query_resource(resource_id, filters/sort/page | sql)──▶ tools/query-resource
        ├─ getResource + detectCapability (cached per resource_id, 10 min)
        ├─ formats.registry.resolve(ctx) → ResourceAccessor
        │     tabular_api → clients.tabular.queryData
        │     parquet     → engines.duckdb (if enabled) | accessors/parquet (hyparquet, bounded)
        │     stream_parse→ download.ts (≤ MAX_DOWNLOAD_BYTES) → csv/xlsx/json parser → in-memory filter/sort/page
        └─ TableSlice → tools/shared/formatters.table() → capOutput → {content, structuredContent}
```

Every hop maps failures to `DatagouvError` (§6); tools never throw to the transport.

## 2. Shared interfaces (already in code — code against them)

| Contract | File | Consumers |
|----------|------|-----------|
| `Config`, `ApiBaseUrls`, `loadConfig` | `src/core/config.ts` | all |
| `DatagouvError` + subclasses, `toDatagouvError` | `src/core/errors.ts` | all |
| `HttpClient`, `buildUrl`, `FetchLike` | `src/core/http.ts` | clients, formats/download |
| `Cache` | `src/core/cache.ts` | clients, formats |
| Entity types (`DatasetSummary`, `ResourceDetail`, `ResourceAnalysis`, `TableSchema`, `TableSlice`, `Page<T>`…) | `src/core/types.ts` | all |
| `DatagouvClient`, `TabularClient`, `MetricsClient`, `CrawlerClient`, `SchemaClient`, `Clients` | `src/clients/types.ts` | A implements; B, C consume |
| `ResourceCapability`, `CapabilityReport`, `CapabilityDetector`, `ResourceAccessor`, `QueryEngine`, `QuerySpec`, `PreviewResult` | `src/formats/types.ts` | B implements; C consumes |
| `AccessorRegistry` | `src/formats/registry.ts` | B registers; C resolves |
| `ToolDefinition`, `ToolContext`, `ToolResult`, `defineTool`, `registerTools` | `src/tools/types.ts`, `registry.ts` | C |
| `ServerDeps`, `createDeps` | `src/server/deps.ts` | C, D |
| Test helpers `startTestServer`, `routedFetch` | `tests/helpers/mcp-client.ts` | D (owner), all for tests |

Widening rule: `ToolDeps` (tools/index.ts) and `ServerDeps.datagouv` currently use `DatagouvSearchClient = Pick<DatagouvClient,"searchDatasets">`. When A lands the full client, C replaces the `Pick` with `Clients` in `ServerDeps`. Interfaces may be **extended** by owners; **breaking** changes to shared contracts require an ADR update and a note in this plan.

## 3. Legacy tools (parity, names preserved)

| # | Tool | Upstream | Parity notes |
|---|------|----------|--------------|
| 1 | `search_datasets` ✅ | v2 `/datasets/search/` | stop-word cleaning + fallback; `sort`, `last_update_range`; `resources_count` from `resources.total` |
| 2 | `search_organizations` | v2 `/organizations/search/` | browse mode with empty query; `badge`, `name`, `business_number_id`, `sort` |
| 3 | `search_dataservices` | v2 `/dataservices/search/` | includes `base_api_url` |
| 4 | `get_dataservice_info` | v1 `/dataservices/{id}/` | 404 → NOT_FOUND message with `dataservice_id` |
| 5 | `get_dataservice_openapi_spec` | spec URL (JSON/YAML) | endpoint summary only (method, path, summary, params); servers max 3 |
| 6 | `query_resource_data` | tabular `/data/` | operators exact/contains/less/greater/strictly_*; add `differs`, `in`; `page_size` 1–200; LLM-friendly 404/4xx/5xx messages |
| 7 | `get_dataset_info` | v1 `/datasets/{id}/` | description 500 chars; tags max 10; license, frequency, dates |
| 8 | `list_dataset_resources` | v1 `/datasets/{id}/` | single call; size humanised; **new**: per-resource `access_hint` from offline capability detection |
| 9 | `get_resource_info` | v2 resource + crawler + tabular profile | Tabular availability + exception distinction → now returns full `CapabilityReport` |
| 10 | `get_metrics` | metrics `/datasets|resources/data/` | demo guard; `limit` 1–50; None→0; monthly table |

Registration order = legacy order (Appendix A of research/01), new tools appended.

## 4. New tools (v1.0)

| Tool | Purpose / justification | Upstream | Owner |
|------|-------------------------|----------|-------|
| `get_resource_schema` | Columns + types + row count for **any** queryable resource (tabular profile, parquet footer, inferred from sample, or declared TableSchema). Fills the audit's "no column discovery" gap. | tabular `/profile/`, parquet, stream sample, schema.data.gouv.fr | C (uses B) |
| `preview_resource` | Bounded first-N rows / features / text / archive listing for any format (Tier 1–3). Replaces the removed unsafe download tool with hard caps. | formats accessors | C (uses B) |
| `query_resource` | Unified query across formats: same filter/sort/page vocabulary as `query_resource_data`, routed by capability (Tabular API → Parquet/DuckDB → in-memory). Optional `sql` (single read-only SELECT) when DuckDB enabled. `query_resource_data` stays as the Tabular-only alias. | formats + engines | C (uses B) |
| `check_resource_availability` | Fast HEAD/`check:*` status: is the URL alive, size, content-type, last-modified, dead-link diagnosis. Avoids LLM wasting calls on 79% remote resources with link rot. | v2 resource extras + HEAD | C (uses A) |
| `get_dataset_resources_summary` | One-call overview of a dataset: resources grouped by format family with best access path, sizes, freshness, recommended resource to start with. Cuts the search→list→info hop count. | v1 dataset + offline detection | C (uses B offline detector) |
| `suggest` | Autocomplete across datasets / organizations / tags / spatial zones / formats (`/suggest/` endpoints) — cheap disambiguation before a full search. | v1 suggest endpoints | C (uses A) |
| `search_reuses` | Discover reuses (apps, articles) of a dataset or topic — shows how data is used, useful for grounding. | v1 `/reuses/` (+ `dataset=` filter) | C (uses A) |
| `search_topics` / `get_topic` | Curated collections (topics) with their datasets; HVD browsing via `badge=hvd` exposed as a `badge` filter on `search_datasets` and a `list_high_value_datasets` convenience wrapper. | v2 topics, v1 badges | C (uses A) |
| `list_schemas` / `get_schema` | schema.data.gouv.fr catalogue and field definitions (TableSchema) — lets the LLM understand standardised datasets (IRVE, BAL…) and find consolidated datasets. | schema.data.gouv.fr `schemas.json` + schema files | C (uses A) |
| `validate_resource_against_schema` | Run Validata on a resource URL for a schema; report error count and first errors. Read-only external call. | Validata `/validate` | C (uses A) — **optional**, ship if time allows |
| `geo_lookup` (optional) | Resolve a commune/département/région name → INSEE code / geozone id (`/spatial/zones/suggest/` + geo.api.gouv.fr) to build `geozone` filters. Justified by the volume of geo-indexed datasets (4,243 with `country:fr` alone). | v1 spatial suggest, geo.api.gouv.fr | C — **optional** |

`search_datasets` gains optional facet filters (`organization`, `tag`, `license`, `format`, `badge`, `geozone`, `granularity`, `schema`, `topic`) — additive, legacy params untouched.

## 5. Resource capability detection (research/03 §7, normative)

Input: `ResourceDetail` (v2 endpoint, extras parsed into `analysis`). Output: `CapabilityReport` (`src/formats/types.ts`). Steps run in order; the first matching primary wins, later applicable ones are appended as fallbacks.

1. `analysis.checkAvailable === false` or `checkStatus >= 400` → primary `dead_link` (keep `metadata_only`; warnings include check date/error/url).
2. `type === "api"` or format ∈ {wms, wfs, ogc:*, arcgis…, "api"} or `ogcMetadata` present → `api_endpoint`.
3. `type === "documentation"` or format ∈ {pdf, html, web page, document, docx, odt, md, txt(non-tabular), png, jpg, jpeg} → `document_preview` (images → `metadata_only`).
4. `analysis.parsingTable` present → `tabular_api` (probe `/profile/` unless `offline`; 200 → confirm; 404 → downgrade and continue). If resource ∈ crawler exceptions → `tabular_api_large`.
5. format ∈ {csv, csv.gz, tsv, xlsx, xls, ods} and `filetype === "file"` (or remote with `checkAvailable === true`) → probe tabular once; on miss: if `analysisError` ~ "too large" and `parquetUrl` → `parquet`; else `stream_parse` (size ≤ `MAX_DOWNLOAD_BYTES` else `remote_caution`).
6. format === parquet or `parquetUrl` present → `parquet`.
7. format ∈ {geojson, json(with geo mime), kml, gpx, topojson} or `geojsonUrl` → `geo_preview`; plain json/jsonl → `stream_parse`.
8. format ∈ {zip, shp, gpkg, kmz, 7z, tar.gz, dbf} → `archive_inspect` (never auto-extract > `MAX_DOWNLOAD_BYTES`).
9. `filetype === "remote"` and nothing above matched → `remote_caution` (HEAD only; `contentLength` from analysis).
10. default → `metadata_only`.

Rules: never trust `format` alone (74k empty formats); normalise `csv.gz`→csv+gzip; use `detectedMime` when declared mime is `application/javascript`/`text/html` on a "csv" (mismatch warning); `sizeBytes` = `filesize ?? analysis.contentLength`; always return `urls.latest`. Detection is cached per resource id (10 min) and has an `offline` mode used by `list_dataset_resources`/`get_dataset_resources_summary` (no probes).

## 6. Error taxonomy (`src/core/errors.ts`)

| Code | Class | Retryable | Typical hint |
|------|-------|-----------|--------------|
| `VALIDATION_ERROR` | ValidationError | no | fix parameters (also used for upstream shape mismatch) |
| `CONFIG_ERROR` | ConfigError | no | startup only |
| `NOT_FOUND` | NotFoundError | no | "check the id with search_datasets / list_dataset_resources" |
| `API_ERROR` | ApiError(status,url) | 5xx yes | upstream failure |
| `RATE_LIMITED` | RateLimitError(retryAfterMs) | yes | wait / reduce page_size |
| `TIMEOUT` | TimeoutError | yes | smaller page / fewer filters |
| `NETWORK_ERROR` | NetworkError | yes | — |
| `FORMAT_ERROR` | FormatError | no | file not parseable as declared format |
| `RESOURCE_UNAVAILABLE` | ResourceUnavailableError | no | dead link; use another resource |
| `UNSUPPORTED_CAPABILITY` | UnsupportedCapabilityError | no | "use get_resource_info / preview_resource" |
| `PAYLOAD_TOO_LARGE` | PayloadTooLargeError | no | use Tabular/Parquet path or download URL |
| `ENGINE_UNAVAILABLE` | EngineUnavailableError | no | DuckDB disabled: use filters instead of sql |
| `INTERNAL_ERROR` | DatagouvError | no | bug; logged with stack |

Tool boundary (`tools/registry.ts`): any error → `{ isError: true, content: "Error [CODE]: message\nHint: …", structuredContent: { error } }`. Never a JSON-RPC error for business failures (clients handle `isError` far better). Legacy in-band strings (`Error: Dataset with ID 'x' not found.`) are preserved as the `message` for the corresponding tools.

## 7. Caching strategy (ADR 0009)

| Data | TTL | Key |
|------|-----|-----|
| dataset search / org / dataservice search pages | 60 s | `datagouv:search-*:<querystring>` |
| dataset / resource / dataservice detail | 5 min | `datagouv:dataset:<id>` … |
| tabular profile | 10 min | `tabular:profile:<rid>` |
| tabular data pages | 60 s | `tabular:data:<rid>:<querystring>` |
| crawler exceptions | 1 h, stale-on-error | `crawler:exceptions` |
| aggregation exceptions | 1 h | `tabular:aggregation-exceptions` |
| capability report | 10 min | `formats:capability:<rid>` |
| schema catalogue | 1 h | `schema:catalog` |
| metrics | 10 min | `metrics:<model>:<id>:<limit>` |
| downloaded file bytes | **not cached** (memory); parsed preview slices 5 min, bounded | `formats:preview:<rid>:<member>:<limit>` |

In-memory LRU (`CACHE_MAX_ENTRIES`, default 500); in-flight dedupe. No disk cache in 1.0.

## 8. Output shaping (ADR 0008)

- Every tool returns `content[0].text` (Markdown-ish plain text, legacy-compatible layout) **and** `structuredContent` (snake_case keys, same data).
- Text soft cap `MAX_OUTPUT_CHARS` (default 40k chars ≈ 10k tokens) via `capOutput`; truncation notice + `howToGetMore`; `structuredContent.text_truncated=true`.
- Tables: cell values truncated to 100 chars; max 200 rows per call; column list first; totals + pagination line; "next page" hint.
- Descriptions: 200 chars in lists, 500 in detail; tags max 5/10 as legacy.
- Never dump raw `extras`; expose the normalised `analysis` fields.
- Errors: see §6. Warnings (dead link, mismatch, huge file) prefixed `Warning:`; no emoji dependence (legacy `⚠️` kept only in `query_resource_data` messages for continuity).

## 9. Observability

- pino JSON logs to **stderr** (`LOG_LEVEL`, legacy uppercase accepted); per tool call: `tool called {args}` / `tool completed {ms}` / `tool failed {code}`; redaction of tokens.
- `/health`: deep probe (`search_datasets("transport", 1)`), legacy JSON shape (`status, uptime_since, version, env, data_env`), 503 `mcp_unavailable`.
- Matomo (optional, `MATOMO_URL`+`MATOMO_SITE_ID`): tool events `e_c=tools e_a=<tool>` fire-and-forget; health override; `MATOMO_AUTH_TOKEN` enables `cip`. Sentry (optional, `SENTRY_DSN`, `SENTRY_SAMPLE_RATE`, `MCP_ENV`).
- No Prometheus in 1.0 (tech debt candidate).

## 10. Config / env vars

Legacy-compatible: `MCP_HOST` (default 127.0.0.1 — legacy default was 0.0.0.0; Docker sets 0.0.0.0 explicitly), `MCP_PORT`, `MCP_ENV`, `DATAGOUV_API_ENV`, `LOG_LEVEL`, `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_SAMPLE_RATE`.
New: `MCP_TRANSPORT`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `HTTP_TIMEOUT_MS`, `HTTP_RETRIES`, `MAX_DOWNLOAD_BYTES`, `CACHE_MAX_ENTRIES`, `CACHE_DEFAULT_TTL_MS`, `MAX_OUTPUT_CHARS`, `ENABLE_DUCKDB`. See `.env.example`; source of truth `src/core/config.ts`.

## 11. Milestones

- [x] **M0 — Scaffold & contracts** (architect, 2026-09-03): repo layout, toolchain green, shared interfaces, `search_datasets`, both transports, e2e/live tests, evidence generator, ADRs 0001–0010.
- [x] **M1 — Clients & core hardening** (A, 2026-09-03): all `Clients` implemented; `createClients()` in `createDeps`; 5 contract test files; fixtures for each upstream.
- [x] **M2 — Formats layer** (B, 2026-09-03): capability detector, Tier 1–3 accessors, DuckDB engine behind flag; unit tests green.
- [x] **M3 — Tool parity** (C, 2026-09-03): 10 legacy tools green with offline + live evidence; `legacy/python/` retained until M6 (TD-004).
- [x] **M4 — New tools** (C on B, 2026-09-03): 11 core new tools shipped (`get_resource_schema`, `preview_resource`, `query_resource`, `check_resource_availability`, `get_dataset_resources_summary`, `suggest`, reuses, topics/HVD). Optional schema/geo tools (`list_schemas`, `get_schema`, `validate_resource_against_schema`, `geo_lookup`) deferred per §4.
- [ ] **M5 — Quality gates** (D, partial): `pnpm check` + `test:coverage` green (TD-009 floors, below ADR 0010 90%); 21/21 evidence offline+live; `evidence:check` + `test:conformance` green locally; nightly live workflow. **Open**: `evidence:check` not in CI; `test:conformance` soft-fail (`continue-on-error`); automated live vitest 1/21; no stress test port.
- [ ] **M6 — Release** (E, partial/alpha): README + docs + CI + Docker + changesets present; package `1.0.0-alpha.0`; PR #1 open with green CI. **Open**: `1.0.0` tag / npm publish; delete `legacy/python/` (TD-004); hard CI gates for evidence + conformance.

## 12. Workstreams (parallel, disjoint file ownership)

| WS | Scope | Owns (exclusive) | Depends on | Can start |
|----|-------|------------------|------------|-----------|
| **A — core + clients** | Finish `DatagouvClient`, `TabularClient`, `MetricsClient`, `CrawlerClient`, `SchemaClient`; fixtures for each endpoint; retry/cache tuning; OpenAPI fetch (JSON/YAML → needs `yaml` dep) | `src/clients/**` (except `types.ts` signature changes → notify), `src/core/**` (additive only), `tests/fixtures/**`, `tests/contract/**` | M0 | **now** |
| **B — formats** | `capability.ts`, `download.ts`, `accessors/*`, `engines/*` (DuckDB optional, pure-JS fallback), format unit tests with small sample files under `tests/fixtures/files/` | `src/formats/**`, `tests/fixtures/files/**`, `tests/unit/formats/**` | M0; uses `TabularClient`/`CrawlerClient` **interfaces** (mock until A lands) | **now** |
| **C — tools + server** | Remaining 9 legacy tools, new tools (§4), `server/telemetry/*`, `ServerDeps` widening, instructions | `src/tools/**`, `src/server/**`, `src/index.ts`, `tests/e2e/**` | Legacy metadata tools need A's client methods → start with tool files + handlers against interfaces using fakes; integrate as A merges | **now** (parity tools), M4 after B |
| **D — tests & evidence** | Contract test harness (undici MockAgent or `routedFetch`), fixture recorder script, live suite per tool, conformance run, coverage config, evidence for every tool, stress test | `tests/helpers/**`, `tests/live/**`, `scripts/record-fixtures.ts`, `scripts/evidence.ts`, `docs/evidence/**`, `vitest.config.ts` | M0 | **now** (harness), evidence as tools land |
| **E — docs/CI/release** | README (all client configs from legacy README + stdio/npx), `docs/deployment.md`, `.github/workflows/ci.yml` + nightly live, `Dockerfile` (multi-stage), `docker-compose.yml`, release script or changesets, CHANGELOG | `README.md`, `docs/**` (except evidence), `.github/**`, `Dockerfile`, `docker-compose.yml`, `.changeset/**`, `CHANGELOG.md` | M0 (CI can run today) | **now** |

Shared-file protocol: `package.json` deps — add with `pnpm add`, one commit, rebase; `src/clients/types.ts`, `src/formats/types.ts`, `src/core/types.ts` — additive changes by any WS allowed, breaking changes only via A/B owner + plan note; `.agent/**` — each WS writes its own journal/exec-plan file, orchestrator edits `ownership.md`.

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-03 | ADRs 0001–0010 accepted | see `decisions/` |
| 2026-09-03 | `description_short` derived from markdown `description` when API returns null | live API v2 search returns `description_short: null`; LLM needs a summary |
| 2026-09-03 | Stateless HTTP with `enableJsonResponse: true` | legacy `stateless_http=True`; no server-initiated notifications used |
| 2026-09-03 | tsdown 0.21.x (not 0.22) | 0.22 requires Node ≥ 22.18; dev VM has 22.14 (TD-003) |

## Open questions

- [ ] `query_resource` `sql` mode: allow only when `ENABLE_DUCKDB=1` **and** an allow-list of read-only statements passes — confirm with orchestrator whether to ship in 1.0 or 1.1 (B/C).
- [ ] Should `list_dataset_resources` paginate (v2 `/resources/`) for datasets with > 200 resources? Legacy returned all. Proposal: all up to 200 then paginate (C).
- [ ] Docker base image: `node:22-alpine` vs `node:22-slim` if DuckDB native binary is bundled (E, B).

## Progress log

### 2026-09-03 — architect

- Legacy moved to `legacy/python/`; TS scaffold at root; core/clients/formats/tools/server skeleton with real `search_datasets`; stdio + HTTP transports; 42 tests green; live smoke via stdio recorded in `docs/evidence/search_datasets-2026-09-03.md` and `journal/2026-09-03-architect-scaffold.md`.
- Files: `package.json`, `src/**`, `tests/**`, `scripts/**`, `.agent/decisions/0001–0010`, this plan.
- Next: orchestrator launches A–E with briefs from the journal.
