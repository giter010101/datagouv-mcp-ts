# Latent work inventory — post usage-limit interrupt

> **Superseded** (2026-09-03): see `journal/2026-09-03-integration-complete.md` and updated `ownership.md` for current status. This file is kept as a historical snapshot at commit `d0c984e`.

**Date**: 2026-09-03  
**Agent**: research/review (Composer 2.5)  
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0`  
**PR**: https://github.com/giter010101/datagouv-mcp-ts/pull/1  
**HEAD**: `d0c984e` — `wip: partial workstreams A/B/C (clients, formats, tools) + CONTRIBUTING/SECURITY — interrupted, to be completed`

## Git state

```
d0c984e wip: partial workstreams A/B/C … (interrupted)
89292f9 feat(formats): capability detection, parsers, engines (B — pre-WIP, complete commit)
6ffb433 test(fixtures): manifest-driven live fixture recorder + 42 recorded fixtures (D)
2ca988a docs: architecture, configuration, deployment, development, migration (E)
… M0 scaffold (c276f87 search_datasets only registered)
```

`git status`: clean, up to date with `origin/cursor/datagouv-mcp-typescript-refonte-57e0`.

## Verification snapshot (2026-09-03)

| Gate | Result |
|------|--------|
| `pnpm typecheck` | **FAIL** — 17 errors in 4 files |
| `pnpm test` | **FAIL** — 72 passed, **1 failed** (73 total, 10 files) |
| `pnpm check:layers` | OK |
| `pnpm lint` | **FAIL** — 53 errors, 1 warning (mostly Biome format/organizeImports on WIP files) |

### Typecheck errors (exact)

```
src/clients/mappers/dataset.ts(73,36): TS2345 — toDatasetSummary(raw) where raw is ApiDatasetDetail; `resources` union (array \| {total}) incompatible with ApiDatasetSearchItem's `{ total? }` shape

src/tools/check-resource-availability.ts(111–115): TS2339 ×12 — property access on live-probe union without narrowing (`content_type`, `content_length`, `last_modified`, `final_url`, `error` on error branch)

src/tools/index.ts(1,15): TS2305 — `SearchDatasetsDeps` not exported from `./search-datasets.js`

src/tools/topics.ts(142,52/75/107): TS2339/TS2345 — `TopicElement` used as `DatasetSummary` (`organization`, `resourcesCount`, `datasetToStructured`)
```

### Test failure (exact)

```
tests/e2e/search-datasets.test.ts > is listed with legacy-compatible name, annotations and input schema
  Expected input schema keys: [last_update_range, page, page_size, query, sort]
  Received: [badge, format, geozone, granularity, last_update_range, license, organization, page, page_size, query, schema, sort, tag, topic]
```

---

## `src/` tree inventory (90 files)

### `src/core/` (9 files) — **Done**

| File | Status |
|------|--------|
| `config.ts`, `errors.ts`, `logger.ts`, `cache.ts`, `http.ts`, `text.ts`, `version.ts` | Complete |
| `types.ts` | Extended in WIP (+TopicElement, ReuseDetail, etc.) |
| `*.test.ts` | Present (config, cache, http) |

### `src/clients/` (18 files) — **Partial** (implementations largely complete; 1 type error; no contract tests)

| File | Status |
|------|--------|
| `types.ts` | Complete contract (DatagouvClient 20+ methods, Tabular, Metrics, Crawler, Schema, Clients) |
| `index.ts` | **`createClients()`** factory — complete |
| `datagouv-client.ts` | **Complete** — all DatagouvClient methods implemented (~395 lines) |
| `datagouv-reference.ts` | Complete — suggest, licenses, badges, spatial, schemas, site |
| `tabular-client.ts` | Complete — profile, query, aggregate, swagger |
| `metrics-client.ts` | Complete — demo guard |
| `crawler-client.ts` | Complete — exceptions (1h cache), health |
| `schema-client.ts` | Complete — catalogue, getSchema, Validata validate |
| `openapi.ts` | Complete — JSON/YAML parse + summarize |
| `mappers/dataset.ts` | **Broken** — `toDatasetDetail` → `toDatasetSummary(ApiDatasetDetail)` type mismatch |
| `mappers/entities.ts` | Complete |
| `mappers/text.ts` | Complete |
| `schemas/*.ts` (7 files) | Complete Zod schemas |

**Missing for A**: `tests/contract/**` (0 files), contract-test coverage per endpoint.

### `src/formats/` (21 files) — **Partial** (detector + parsers + engines; **zero accessors**)

| Area | Files | Status |
|------|-------|--------|
| Contracts | `types.ts` | Complete (CapabilityReport, ResourceAccessor, QueryEngine, FormatsDeps, OpenedResource) |
| Registry | `registry.ts`, `registry.test.ts` | Registry class complete; **no accessors registered** |
| Detection | `capability.ts`, `format-names.ts`, `sniff.ts` | Complete (~426 lines detector) |
| Download | `download.ts` | Complete (bounded, gzip, decode) |
| Parsers | `parsers/{csv,json,parquet,spreadsheet,geojson,xml}.ts` | Complete |
| Engines | `engines/{pure-js,duckdb,query,sql-guard,index}.ts` | Complete |
| Inference / text | `infer.ts`, `text-shaping.ts` | Complete |
| Barrel | `index.ts` | **Stub** — exports only `registry` + `types` (not capability, engines, download) |
| **Accessors** | `accessors/*` | **Missing entirely** — no `ResourceAccessor` implementation in repo |
| Wiring | `defaultAccessors()`, `openResource()` in formats layer | **Missing** — `openResource` lives in `tools/shared/resource-access.ts` instead |

**Missing for B**: `tests/fixtures/files/**` (0 sample files), accessor unit tests, registry population.

### `src/tools/` (32 files) — **Partial** (21 tool handlers written; 1 registered)

#### Tool files vs registration

| Tool file | `name` | Registered in `ALL_TOOLS` |
|-----------|--------|----------------------------|
| `search-datasets.ts` | `search_datasets` | **Yes** (only one) |
| `search-organizations.ts` | `search_organizations` | No |
| `search-dataservices.ts` | `search_dataservices` | No |
| `get-dataservice-info.ts` | `get_dataservice_info` | No |
| `get-dataservice-openapi-spec.ts` | `get_dataservice_openapi_spec` | No |
| `query-resource-data.ts` | `query_resource_data` | No |
| `get-dataset-info.ts` | `get_dataset_info` | No |
| `list-dataset-resources.ts` | `list_dataset_resources` | No |
| `get-resource-info.ts` | `get_resource_info` | No |
| `get-metrics.ts` | `get_metrics` | No |
| `get-resource-schema.ts` | `get_resource_schema` | No |
| `preview-resource.ts` | `preview_resource` | No |
| `query-resource.ts` | `query_resource` | No |
| `check-resource-availability.ts` | `check_resource_availability` | No (type errors) |
| `get-dataset-resources-summary.ts` | `get_dataset_resources_summary` | No |
| `suggest.ts` | `suggest` | No |
| `reuses.ts` | `search_reuses`, `get_reuse_info` | No |
| `topics.ts` | `list_topics`, `get_topic` | No (type errors in `get_topic`) |
| `list-high-value-datasets.ts` | `list_high_value_datasets` | No |

**Not started** (exec-plan §4): `list_schemas`, `get_schema`, `validate_resource_against_schema`, `geo_lookup`.

#### Shared / infra

| File | Status |
|------|--------|
| `deps.ts` | **New canonical `ToolDeps`** = `Clients & { formats, config, http }` |
| `index.ts` | **Stale** — still `ToolDeps = SearchDatasetsDeps`; `ALL_TOOLS = [searchDatasetsTool]` only |
| `registry.ts` | Complete SDK adapter |
| `shared/*` | Complete helpers (resource-access, formatters, output-schemas, capability-hints, sql-guard, tabular-errors) |

### `src/server/` (4 files) — **Partial** (transports OK; deps not widened)

| File | Status |
|------|--------|
| `deps.ts` | **Stale** — `DatagouvSearchClient` only; empty `createAccessorRegistry()`; no `createClients`, no formats detector/engines |
| `mcp-server.ts` | Complete but registers only `ALL_TOOLS` (1 tool) |
| `http.ts`, `stdio.ts` | Complete (M0) |
| `telemetry/*` | **Missing** |

### `src/index.ts` — Complete CLI (unchanged from M0).

---

## Workstream status vs exec-plan

| WS | Status | Evidence |
|----|--------|----------|
| **A — clients** | **Partial (~90%)** | All 5 clients + `createClients` implemented; 1 mapper type error; no `tests/contract/**` |
| **B — formats** | **Partial (~60%)** | Detector, download, parsers, engines done (commit `89292f9`); **no accessors**, empty registry, `formats/index.ts` incomplete |
| **C — tools + server** | **Partial (~70% files, ~5% wired)** | 21 tool definitions on disk; only `search_datasets` registered; `server/deps.ts` not integrated; 3 typecheck errors; no telemetry |
| **D — tests & evidence** | **Partial (~50%)** | Vitest projects, fakes, 42 recorded fixtures, recorder script, 1 evidence report; no contract tests; 1/21 tools evidenced; 1 e2e failure |
| **E — docs/CI/release** | **Mostly done (~85%)** | README, docs/*, CI/docker/nightly/changesets (commits before WIP); CONTRIBUTING/SECURITY in WIP; docs may overclaim unregistered tools |

---

## Duplicates & contradictions

### Duplicate definitions

| Concept | Location A | Location B | Issue |
|---------|------------|------------|-------|
| `ToolDeps` | `tools/deps.ts` — full `Clients & formats & config` | `tools/index.ts` — `SearchDatasetsDeps` | **index.ts stale**; causes `SearchDatasetsDeps` import error |
| `FormatsDeps` | `formats/types.ts` — http, tabular, engines, maxDownloadBytes | `tools/deps.ts` — registry, detectCapability, engine | Different shapes; server must compose one |
| `OpenedResource` | `formats/types.ts` — with `getSchema/preview/query` methods | `tools/shared/resource-access.ts` — with `ctx`, `accessor` | Parallel façades; tools use the latter |
| `ReuseDetail` | `core/types.ts` | `tools/deps.ts` `DatagouvClientExtensions` | Redundant extension type |

### Contradictory types / missing exports

1. **`SearchDatasetsDeps`** — imported by `tools/index.ts` but never exported; `search-datasets.ts` uses `ToolDeps` from `./deps.js`.
2. **`TopicElement` vs `DatasetSummary`** — `get_topic` treats `topic.elements` as datasets with `organization`, `resourcesCount`, `datasetToStructured()`.
3. **Live-probe union** — `liveCheck()` success object has `final_url`, `content_type`, etc.; `failure()` omits them → TS2339 when formatting `live` without `live.ok` guard.
4. **`ApiDatasetDetail.resources`** — Zod union `array | {total}` passed to `toDatasetSummary(ApiDatasetSearchItem)` in `toDatasetDetail`.

### Integration gaps (C ↔ A ↔ B)

| Gap | Detail |
|-----|--------|
| `server/deps.ts` | Does not call `createClients()`; still `createDatagouvClient` + `DatagouvSearchClient` |
| Formats wiring | No `createCapabilityDetector`, `createEngines`, or accessor registration in server |
| `ALL_TOOLS` | 20 handlers exist but are not imported/registered |
| `openResource` | Tools call `deps.formats.detectCapability` + `deps.formats.registry.tryResolve` — **will always get `undefined` accessor** until B registers accessors and C wires deps |
| M4 tools | `preview_resource`, `query_resource`, `get_resource_schema` depend on accessors that do not exist |

---

## Tests & evidence (D)

| Asset | Count / status |
|-------|----------------|
| Offline tests | 73 (72 pass, 1 fail) |
| Live tests | 1 file (`tests/live/search-datasets.live.test.ts`) |
| E2E | 2 files (`search-datasets`, `http-transport`) |
| Contract tests | **0** (`tests/contract/` missing) |
| Unit formats | 1 file (`capability.test.ts`) |
| Fixture files (binary) | **0** (`tests/fixtures/files/` missing) |
| Recorded API fixtures | 42 under `tests/fixtures/api/recorded/` |
| Evidence reports | **1** (`docs/evidence/search_datasets-2026-09-03.md`) |

---

## Next actions for Grok implementers

### (1) Make typecheck green

1. Fix `toDatasetDetail`: separate summary mapper for `ApiDatasetDetail` or widen `toDatasetSummary` input / use `resourcesTotal()` only.
2. Narrow `live` probe in `check-resource-availability.ts` (`if (live && live.ok) { … }` / discriminated union).
3. Reconcile `tools/index.ts`: export `ToolDeps` from `./deps.js`, remove `SearchDatasetsDeps`, register all tools.
4. Fix `get_topic`: map `TopicElement` fields (`elementClass`, `url`) — do not use `datasetToStructured`.
5. Run `pnpm biome check --write` on WIP client/tool files (53 lint errors).

### (2) Finish A

6. Add `tests/contract/**` per client method using recorded fixtures + MockAgent.
7. Verify `pnpm test:coverage` meets thresholds for `src/clients/**`.

### (3) Finish B

8. Implement `src/formats/accessors/*` (tabular-api, csv-stream, spreadsheet, json, geojson, parquet, archive, document, api-endpoint, metadata).
9. Export `defaultAccessors(deps)` + wire `createCapabilityDetector` + `createEngines` from `formats/index.ts`.
10. Add `tests/fixtures/files/**` samples + accessor unit tests.
11. Register accessors in server deps (or factory called from `createDeps`).

### (4) Finish C

12. Widen `server/deps.ts`: `createClients(config, {http, cache})`, build `FormatsDeps` (detector + engines + populated registry), export full `ToolDeps`.
13. Register all 21 tools in legacy order in `ALL_TOOLS`; update `SERVER_INSTRUCTIONS`.
14. Add missing schema tools (`list_schemas`, `get_schema`) if in scope.
15. Add `server/telemetry/` (Matomo/Sentry) per exec-plan §9.

### (5) Finish D evidence

16. Update e2e `search-datasets` test to expect facet params (or document additive change).
17. Add e2e per registered tool; run `pnpm evidence --tool <name>` for each → `docs/evidence/`.
18. Add `tests/contract/**` harness usage.

### (6) Refresh E docs

19. Regenerate `docs/tools.md` after registration (`pnpm docs:tools`).
20. Verify README tool list matches `ALL_TOOLS` count; note DuckDB/optional tools accurately.

---

## Commit lineage reference

- **M0** (`c276f87`): 1 tool, green typecheck/test (42 tests).
- **D+E** (`2ca988a`–`6ffb433`): docs, CI, fixtures recorder — still green before WIP.
- **B** (`89292f9`): formats core without accessors — tests still pass.
- **WIP** (`d0c984e`): A clients + C tool files landed together — **typecheck broken**, tests 72/73.
