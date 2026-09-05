# Completion re-audit #2 — TypeScript rewrite objective

**Date**: 2026-09-03  
**Auditor**: Composer (strict re-audit; supersedes `2026-09-03-completion-audit.md` and `2026-09-03-post-audit-status.md`)  
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0`  
**Commit**: `603c727` (`docs(journal): record CI unstick takeover and local green gates`)  
**PR**: https://github.com/giter010101/datagouv-mcp-ts/pull/1  
**Objective source**: `.agent/exec-plans/001-typescript-rewrite.md` (Goal + deliverables A–E)

## Tree verification

```bash
git pull origin cursor/datagouv-mcp-typescript-refonte-57e0
# → Already up to date.
```

## Mandatory command outputs (current tree)

### `pnpm check` — exit 0

```
typecheck   OK
lint        Checked 230 files — no fixes
check:layers OK — core ← clients ← formats ← tools ← server
test        22 passed | 1 skipped (23 files); 150 passed | 1 skipped (151 tests); ~3.1s
build       dist/index.js 322.47 kB — Build complete in 72ms
```

### `pnpm test:coverage` — exit 0

```
Statements 67.59% | Branches 51.81% | Functions 71.46% | Lines 70.46%
All COVERAGE_THRESHOLDS in vitest.config.ts met (floors per TD-009)
```

### `pnpm evidence:check` — exit 0

```
evidence:check OK — 21 tools, 42 coverage row(s) in docs/evidence/coverage.md
```

### `pnpm test:conformance` — exit 0

```
conformance OK — 21 tools, search_datasets total=1234
```

## Inventory counts

| Metric | Count | Evidence |
|--------|------:|----------|
| `ALL_TOOLS` registered | **21** | `src/tools/index.ts` lines 37–61 |
| `coverage.md` rows | **42** | 21 tools × (offline + live) |
| Evidence markdown files (excl. `coverage.md`, `README.md`) | **43** | 21 `*-live.md`, 21 `*-offline-2026-09-03.md`, 1 legacy `search_datasets-2026-09-03.md` |
| Offline e2e tool cases | **21** | `tests/e2e/all-tools-offline.test.ts` |
| Contract test files | **5** | `tests/contract/{datagouv,tabular,metrics,crawler,schema}-client.test.ts` |
| Live vitest files | **1** | `tests/live/search-datasets.live.test.ts` |
| Stress tests | **0** | `tests/stress/` absent (ADR 0010: opt-in, not default) |

### `ALL_TOOLS` names (registration order)

1. search_datasets · 2. search_organizations · 3. search_dataservices · 4. get_dataservice_info · 5. get_dataservice_openapi_spec · 6. get_dataset_info · 7. list_dataset_resources · 8. get_resource_info · 9. query_resource_data · 10. get_metrics · 11. check_resource_availability · 12. get_dataset_resources_summary · 13. get_resource_schema · 14. get_reuse_info · 15. list_high_value_datasets · 16. list_topics · 17. get_topic · 18. preview_resource · 19. query_resource · 20. search_reuses · 21. suggest

## Targeted checks

### `src/server/deps.ts` uses real `createClients`

**PROVEN** — line 42: `const { datagouv, tabular, metrics, crawler, schema } = createClients(config, { http, cache });` wired into formats + `ServerDeps`. No inline stubs. TD-006 resolved.

### `search_datasets` facets

**PROVEN** — `src/tools/search-datasets.ts` input schema includes `organization`, `tag`, `license`, `format`, `badge`, `geozone`, `granularity`, `schema`, `topic`; `toSearchFilters()` maps to `DatasetSearchFilters`; e2e asserts API passthrough (`tests/e2e/search-datasets.test.ts` “passes facet filters through”). TD-008 resolved.

### Telemetry

**PARTIAL** — `src/server/telemetry.ts` + `createTelemetry()`; hooked in `src/server/mcp-server.ts` via `onToolCall`; unit tests in `tests/unit/server/telemetry.test.ts` (Matomo POST, Sentry structured log on errors, never throws). **Gap vs exec-plan §9 / legacy Python**: Sentry is log-only (no `@sentry/node` SDK, no event ingest); Matomo lacks `cip`/UA forwarding noted in TD-002. TD-002 file still says “not wired” — **stale**.

### `.github/workflows/ci.yml`

**PARTIAL** — matrix Node 22/24 runs `pnpm check`, `pnpm test:coverage`, build artifacts, Docker `/health` smoke. **Gaps**: `pnpm test:conformance` step uses `continue-on-error: true` (line 57); **`pnpm evidence:check` not invoked**; `paths-ignore: docs/evidence/**` means evidence-only commits skip CI.

### PR CI status (2026-09-03 ~17:11 UTC)

All checks **SUCCESS**: `check (node 22.x)`, `check (node 24.x)`, `docker build + /health` (×2 workflow runs).

---

## Deliverable assessment (strict)

### A — `.agent` harness

| Item | Status | Evidence |
|------|--------|----------|
| AGENTS.md entry point | **PROVEN** | `.agent/AGENTS.md` |
| rules / skills / journal / decisions | **PROVEN** | `.agent/rules/*`, `skills/*`, `journal/*` (15+ entries), `decisions/0001–0010` |
| exec-plans | **PROVEN** | `exec-plans/001-typescript-rewrite.md` |
| tech-debt tracker | **PROVEN** | `.agent/tech-debt/` (9 items + README) |
| ownership matrix | **PARTIAL** | Present but stale: still says “telemetry not started”, “contract tests not started”, “live evidence 1/21” |
| Milestones M1–M6 in exec-plan | **PARTIAL** | Only M0 checked; code state exceeds unchecked boxes |
| `datagouv-api-usage.md` skill | **PARTIAL** | Exists; thin vs research depth |

**Deliverable A verdict: PARTIAL** (structure complete; tracking artifacts lag reality).

### B — Platform / format cartography

| Item | Status | Evidence |
|------|--------|----------|
| Python MCP audit | **PROVEN** | `research/01-existing-python-mcp-audit.md` |
| Platform survey | **PROVEN** | `research/02-datagouv-platform-survey.md` |
| Formats catalog (688k resources) | **PROVEN** | `research/03-resource-formats-catalog.md`, `skills/resource-formats.md` |
| Harness / stack research | **PROVEN** | `research/04-harness-engineering-and-ts-stack.md` |

**Deliverable B verdict: PROVEN**

### C — Full TypeScript MCP (parity + improvements)

| Item | Status | Evidence |
|------|--------|----------|
| 21 tools (10 legacy order + 11 new) | **PROVEN** | `ALL_TOOLS`, `tests/e2e/tools-list.test.ts` |
| Layered architecture enforced | **PROVEN** | `pnpm check:layers`, `docs/architecture.md` |
| 5 real API clients | **PROVEN** | `src/clients/index.ts` `createClients()` |
| Formats layer (12 accessors, capability detection) | **PROVEN** | `src/formats/**`, unit tests |
| Error taxonomy + registry `isError` | **PROVEN** | `src/core/errors.ts`, `src/tools/registry.ts` |
| LRU cache + HTTP retry | **PROVEN** | `src/core/cache.ts`, `src/core/http.ts` |
| stdio + Streamable HTTP | **PROVEN** | `src/server/stdio.ts`, `src/server/http.ts`, `src/index.ts` |
| Legacy 10-tool parity | **PROVEN** | Offline e2e + live evidence per legacy tool |
| Optional schema/geo tools (§4) | **MISSING** (accepted deferral) | No `list_schemas`, `get_schema`, `validate_resource_against_schema`, `geo_lookup` in `ALL_TOOLS` — exec-plan marks optional |
| Telemetry production parity | **PARTIAL** | Matomo wired; Sentry log-only (TD-002) |
| `legacy/python/` removal | **PARTIAL** (documented deferral) | TD-004 scheduled; tree retains reference copy |

**Deliverable C verdict: PARTIAL** — core server proven; telemetry Sentry gap and optional tools deferred.

### D — Tests, evidence per feature, CI

| Item | Status | Evidence |
|------|--------|----------|
| `pnpm check` green | **PROVEN** | local + CI |
| Offline unit + e2e (all 21 tools) | **PROVEN** | 150 tests; `all-tools-offline.test.ts` |
| Contract tests | **PROVEN** | 5 client contract files in `tests/contract/` |
| `pnpm test:coverage` green | **PROVEN** | exit 0; floors per TD-009 (below ADR 0010 90% targets) |
| Coverage vs ADR 0010 ≥90% core/clients/formats | **PARTIAL** (documented deferral) | TD-009; measured lines clients 63.5%, formats 70.5% |
| Evidence per tool (offline) | **PROVEN** | 21 `*-offline-2026-09-03.md` |
| Evidence per tool (live) | **PROVEN** | 21 `*-live.md`; `coverage.md` 42 PASS rows |
| `pnpm evidence:check` gate | **PROVEN** locally | **MISSING in CI** |
| `pnpm test:conformance` | **PROVEN** locally | CI **PARTIAL** (`continue-on-error: true`) |
| Live vitest per tool | **PARTIAL** | 1/21 automated live tests |
| Nightly live workflow | **PROVEN** | `.github/workflows/nightly-live.yml` |
| Stress test port | **MISSING** (opt-in per ADR) | no `tests/stress/` |

**Deliverable D verdict: PARTIAL** — offline proof strong; CI gates and automated live regression incomplete.

### E — Docs, CHANGELOG, PR

| Item | Status | Evidence |
|------|--------|----------|
| README + docs set | **PROVEN** | `README.md`, `docs/{architecture,deployment,configuration,tools,development,migration-from-python}.md` |
| CHANGELOG | **PROVEN** | `CHANGELOG.md` [Unreleased] documents rewrite |
| Changesets / release tooling | **PARTIAL** | `.changeset/` present; `1.0.0-alpha.0`, no published release |
| PR #1 open | **PROVEN** | https://github.com/giter010101/datagouv-mcp-ts/pull/1 |
| PR CI green | **PROVEN** | all checks SUCCESS (2026-09-03) |
| PR body accuracy | **PARTIAL** | Still claims “100 pass”, “live evidence search_datasets only”, “prochaines étapes” — stale vs tree |

**Deliverable E verdict: PARTIAL** — documentation strong; release + PR narrative lag code.

---

## Milestone snapshot (exec-plan §11)

| Milestone | Strict status | Notes |
|-----------|---------------|-------|
| M0 Scaffold | **done** | checked in plan |
| M1 Clients + contract tests | **mostly done** | clients real; 5 contract tests; plan unchecked |
| M2 Formats | **done** | plan unchecked |
| M3 Legacy parity + evidence | **mostly done** | 10/10 legacy tools + offline+live evidence; Python retained (TD-004) |
| M4 New tools | **mostly done** | 11 core new tools; optional schema tools deferred |
| M5 Quality gates | **open** | coverage floors low; conformance soft-fail; `evidence:check` not in CI; live vitest 1/21 |
| M6 Release | **open** | no `1.0.0` tag; legacy retained |

---

## Executive verdict

**The FULL original objective is NOT yet proven.**

Compared to the first audit (`2026-09-03-completion-audit.md`), major gaps are **closed**: CI is green, all 21 tools have offline **and** live evidence, `pnpm test:coverage` and `pnpm test:conformance` pass locally, `createClients` + facets + telemetry hook are in place, contract tests exist.

What still blocks calling the rewrite **done** against the exec-plan Goal (“Ship `datagouv-mcp` 1.0.0”) and ADR 0010 strict gates:

### True remaining blockers (not covered by documented tech-debt deferrals)

1. **Release not shipped** — package `1.0.0-alpha.0`; M6 open; no npm publish / `1.0.0` tag.
2. **`pnpm evidence:check` absent from CI** — the per-tool evidence gate is local-only; `docs/evidence/**` changes can skip CI via `paths-ignore`.
3. **`pnpm test:conformance` is informational in CI** (`continue-on-error: true`) — loopback MCP gate is not enforced on merge.
4. **Automated live regression is thin** — only `tests/live/search-datasets.live.test.ts`; nightly cannot catch per-tool live drift for the other 20 tools (committed live markdown is manual proof, not a CI gate).
5. **`.agent` source-of-truth drift** — exec-plan milestones M1–M6 unchecked, `ownership.md` and TD-002/TD-007 stale vs code (risks re-work / false audits).

### Documented deferrals (PARTIAL, not blockers per orchestrator policy)

| Item | Tracker | Status |
|------|---------|--------|
| Coverage below ADR 0010 90% targets | TD-009 | floors green; raise later |
| `legacy/python/` retention | TD-004 | delete at M6 |
| Sentry SDK / full observability parity | TD-002 | Matomo done; Sentry log-only |
| Optional schema/geo tools | exec-plan §4 | explicitly optional |
| Stress tests | ADR 0010 | opt-in, not required for 1.0 |

---

## Delta vs first audit (2026-09-03 ~16:09Z)

| Area | First audit | This audit |
|------|-------------|------------|
| `pnpm test:coverage` | exit 1 (~47% lines) | **exit 0** (~70% lines, TD-009 floors) |
| Live evidence | 1/21 | **21/21** |
| Offline evidence | 1/21 | **21/21** |
| `pnpm evidence:check` | missing | **passes** (not in CI) |
| `pnpm test:conformance` | missing | **passes** (CI soft-fail) |
| Telemetry | unwired | **wired** (Sentry partial) |
| `createClients` / facets | PARTIAL / stubs | **PROVEN** |
| PR CI | red (coverage) | **green** |
| Contract tests | absent | **5 files** |

---

## PR body draft (for orchestrator)

> ## TypeScript rewrite — re-audit status (2026-09-03)
>
> **Verdict: substantial implementation complete; 1.0.0 release gates still open.**
>
> ### Green locally + CI
> - `pnpm check`, `pnpm test:coverage`, `pnpm evidence:check`, `pnpm test:conformance` all exit 0 on `603c727`
> - CI matrix Node 22/24 + Docker `/health` smoke: SUCCESS
>
> ### Shipped in tree
> - **21 MCP tools** (10 legacy order + 11 new), layered `core ← clients ← formats ← tools ← server`
> - Real **`createClients()`** wiring; **`search_datasets` facets** restored
> - stdio + Streamable HTTP; LRU cache; typed errors; formats accessors + optional DuckDB
> - **42 evidence rows** (21 offline + 21 live) indexed in `docs/evidence/coverage.md`
> - 150 offline tests incl. all-tools e2e + 5 contract client suites; Matomo telemetry + Sentry error logs
>
> ### Before calling 1.0.0 done
> 1. Add `pnpm evidence:check` to CI (and reconsider `paths-ignore` on `docs/evidence/**`)
> 2. Make `pnpm test:conformance` a hard CI gate
> 3. Expand `tests/live/` beyond `search_datasets` (or wire nightly to fail on missing live tests)
> 4. Ship release (`changesets` → `1.0.0-alpha.1` / `1.0.0`) and refresh PR body
> 5. Hygiene: tick milestones M1–M5, resolve TD-002 (Sentry SDK) / update TD-007, refresh `ownership.md`
>
> ### Accepted deferrals (tech-debt)
> - Coverage floors below ADR 0010 targets (TD-009)
> - `legacy/python/` until post-release (TD-004)
> - Optional schema/geo tools per exec-plan §4
