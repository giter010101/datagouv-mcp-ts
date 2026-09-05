# Session: Architecture, ADRs and TypeScript scaffold (milestone M0)

**Date**: 2026-09-03
**Agent**: architect
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0` (PR [#1](https://github.com/giter010101/datagouv-mcp-ts/pull/1))

## What was done

- Moved the Python server to `legacy/python/` (git renames), added `legacy/python/README.md`; CHANGELOG `[Unreleased]` + legacy heading.
- Scaffolded the TS package at root: `package.json` (`datagouv-mcp`, bin, scripts dev/build/test/test:live/lint/format/typecheck/check:layers/evidence/check), `tsconfig.json` (strict, NodeNext, `verbatimModuleSyntax`), `biome.json`, `vitest.config.ts`, `tsdown.config.ts`, `.env.example`, `.nvmrc`/`.node-version`, `.gitignore`.
- Implemented `src/core` (config, errors, logger→stderr, LRU cache, HTTP client with retry/timeout, text helpers, shared types, version), `src/clients` (contracts + `HttpDatagouvClient.searchDatasets` with Zod-validated v2 response), `src/formats` (capability/accessor/engine contracts + working `AccessorRegistry`), `src/tools` (`ToolDefinition`, SDK adapter with error mapping + output cap, `search_datasets` legacy port), `src/server` (`createDeps`, `createMcpServer`, stdio, Hono HTTP with `/mcp` stateless + `/health` deep probe + host/origin guard), `src/index.ts` CLI.
- Tests: 8 files / 42 tests (config, cache, http, search-query, registry, layering, MCP e2e in-memory, HTTP loopback) + 1 live test (gated). `scripts/check-layers.ts`, `scripts/evidence.ts`.
- Docs: `exec-plans/001-typescript-rewrite.md`, ADRs 0001–0010, ownership matrix, AGENTS map, tech-debt TD-001…TD-005.

## Verification

```
pnpm typecheck      OK
pnpm lint           Checked 46 files. No fixes applied.
pnpm check:layers   OK — core ← clients ← formats ← tools ← server
pnpm test           Test Files 8 passed · Tests 42 passed (≈0.6 s)
pnpm build          dist/index.js 40.9 kB (tsdown 0.21.10)
pnpm test:live      1 passed (real API)
```

### Live smoke — stdio transport, `search_datasets` with `q=population`

`pnpm build && EVIDENCE_AGENT=architect pnpm evidence --tool search_datasets --input '{"query":"population","page_size":3}' --stdio`
→ `PASS search_datasets in 732 ms → docs/evidence/search_datasets-2026-09-03.md`

```text
Found 2710 dataset(s) for query: 'population'
Page 1 of results:

1. Population
   ID: 53699d0ea3a729239d205b2e
   Description: Ce jeu de données permet d'accéder aux résultats des recensements de la population, à des séries chronologiques de la Banque de Données Macro-économiques de l'Insee sur le thème de la population et...
   Organization: Institut national de la statistique et des études économiques (Insee)
   Tags: deces, demographie, etat-civil, famille, mariages
   Resources: 8
   URL: https://www.data.gouv.fr/datasets/population/

2. Anciennes données carroyées à 200 m sur la population
   ID: 5369931ca3a729239d2040d1
   ...
More results available: use page=2.
```

`structuredContent` keys: `query, effective_query, total, page, page_size, has_next, datasets[]`.

Finding: API v2 search returns `description_short: null` live → client now derives the short description from the markdown `description` (first 300 chars, flattened).

## Decisions

- See ADRs 0001–0010 and exec-plan §Decisions (stateless JSON HTTP; tsdown 0.21 pin; description fallback).

## Blockers

- None. Node 22.14 on the VM forces tsdown 0.21 (TD-003).

## Next steps (for the orchestrator) — workstream briefs

### A — core + clients (start now)
Scope: implement every method of `DatagouvClient` (getDataset, getResource, listDatasetResources, searchOrganizations, searchDataservices, getDataservice, listReuses, searchTopics, getTopic, suggest, fetchOpenApiSpec), `TabularClient`, `MetricsClient`, `CrawlerClient` (1 h stale-on-error), `SchemaClient`. Owned: `src/clients/**`, `src/core/**` (additive), `tests/fixtures/**`, `tests/contract/**`. Interfaces: `src/clients/types.ts` (extend, don't break), map to `src/core/types.ts`; use `HttpClient` + `Cache` only (no `fetch`). Add `yaml` for OpenAPI. Done when: `HttpDatagouvClient implements DatagouvClient`, fixtures recorded from live IDs (research/02 §11), contract tests per endpoint, ≥ 90 % coverage, TD-001 step 1 closed, `pnpm check` green.

### B — formats (start now, mock clients until A lands)
Scope: `capability.ts` (exec-plan §5), `download.ts` (bounded, gzip), accessors `tabular-api`, `csv-stream`, `spreadsheet` (xlsx/xls/ods), `json`/`jsonl`, `geojson`, `parquet` (hyparquet), `archive` (zip listing, shapefile/gpkg metadata), `document` (pdf/txt/md), `api-endpoint`, `metadata`; engines `pure-js` + optional `duckdb` (ADR 0006). Owned: `src/formats/**`, `tests/fixtures/files/**`, `tests/unit/formats/**`. Interfaces: implement `CapabilityDetector`, `ResourceAccessor`, `QueryEngine` from `src/formats/types.ts`; register in `createAccessorRegistry` via an exported `defaultAccessors(deps)`. Done when: detector unit-tested on the research/03 §9 fixtures (offline), every Tier 1–2 format has a sample file + preview/schema/query test, size caps enforced, `pnpm check` green.

### C — MCP tools + server (start now with parity tools)
Scope: port the 9 remaining legacy tools (names/params frozen, ADR 0007) then M4 tools (`get_resource_schema`, `preview_resource`, `query_resource`, `check_resource_availability`, `get_dataset_resources_summary`, `suggest`, reuses/topics/HVD, schema tools); telemetry (TD-002); widen `ServerDeps` to `Clients` (TD-001). Owned: `src/tools/**`, `src/server/**`, `src/index.ts`, `tests/e2e/**`. Interfaces: `defineTool` + `ALL_TOOLS` in legacy order; deps via `ToolContext.deps`; output rules ADR 0008. Done when: each tool has an e2e test (happy + 404 + upstream 5xx) and an evidence report, legacy in-band messages preserved, `pnpm check` green.

### D — tests & evidence (start now)
Scope: `scripts/record-fixtures.ts` (live → `tests/fixtures/<service>/`), undici `MockAgent` option in `tests/helpers`, live suite skeleton per tool, `@modelcontextprotocol/conformance` job, coverage thresholds in `vitest.config.ts`, stress-test port (opt-in), evidence reports as tools land. Owned: `tests/helpers/**`, `tests/live/**`, `scripts/evidence.ts`, `scripts/record-fixtures.ts`, `docs/evidence/**`, `vitest.config.ts`. Done when: `pnpm test` offline < 5 s with coverage gates, nightly live workflow spec handed to E, evidence exists for 100 % of registered tools.

### E — docs / CI / release (start now)
Scope: README rewrite (what/why, `npx datagouv-mcp`, stdio + HTTP, every client config from the legacy README: Claude Desktop/Code, Cursor, Cline, Codex, Windsurf, Autohand…, env table from `src/core/config.ts`), `docs/deployment.md`, `.github/workflows/ci.yml` (typecheck/lint/layers/test/build/conformance/docker smoke) + `nightly-live.yml`, multi-stage `Dockerfile` (`node:22-slim`, `MCP_HOST=0.0.0.0`, `--http`), `docker-compose.yml` with `/health` check, release via changesets or `scripts/release.ts`, `.agent/skills/release.md`. Owned: `README.md`, `docs/**` (not evidence), `.github/**`, `Dockerfile`, `docker-compose.yml`, `.changeset/**`, `CHANGELOG.md`. Done when: CI green on the PR, `docker compose up` serves `/health` 200, README reviewed against `.env.example`.

Parallelism: A, B, D, E start immediately; C starts immediately on tool files/handlers with fakes and integrates as A merges; C's M4 tools wait for B's accessors.
