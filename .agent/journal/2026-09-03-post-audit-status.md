# Post-audit status — TypeScript rewrite objective

**Date**: 2026-09-03  
**Author**: Composer (light review after completion audit)  
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0`  
**Prior audit**: `.agent/journal/2026-09-03-completion-audit.md`  
**Objective source**: `.agent/exec-plans/001-typescript-rewrite.md` (Goal + deliverables A–E)

## What the evidence agent just added (verified)

Commit `38a46dc` (`test(evidence): add tool-to-evidence coverage gate`):

| Artifact | Status |
|----------|--------|
| **21 offline evidence reports** (`docs/evidence/*-offline-2026-09-03.md`) | **Present** — `ls` count = 21 |
| **Evidence index** (`docs/evidence/coverage.md`) | **Present** — 22 rows (21 tools; `search_datasets` has live + offline) |
| **Coverage gate** (`scripts/evidence-coverage.ts` + `pnpm evidence:check`) | **Present & green** — `evidence:check OK — 21 tools, 22 coverage row(s)` |
| **Offline e2e harness** (`tests/e2e/all-tools-offline.test.ts`) | **Present** — parametrized MCP calls with recorded fixtures |
| **Journal entry** (`.agent/journal/2026-09-03-evidence-coverage.md`) | **Present** |
| **ownership.md** (WS D → mostly done) | **Updated** in same commit |

Pre-existing live evidence for `search_datasets` remains: `search_datasets-live.md`, `search_datasets-2026-09-03.md`, `raw/search_datasets-2026-09-03.json`.

## Delta since completion audit

| Area | At audit (16:09Z) | Now |
|------|-------------------|-----|
| Offline evidence per tool | 1/21 (4.8%) | **21/21 (100%)** |
| `pnpm evidence:check` | not in `package.json` | **passes** |
| `pnpm test:coverage` | ~46% lines, fails all layer gates | ~69% lines, **still fails** (clients/formats/tools/server thresholds) |
| `pnpm test:conformance` | `scripts/conformance.ts` missing | **still missing** (sibling fixing) |
| TD-006 / TD-008 | stale `in_progress` | **still `in_progress`** (sibling resolving) |

## Remaining gaps vs original 5 deliverables

Honest assessment against exec-plan Goal + sections A–E:

### A. `.agent` harmonized — **PARTIAL**

- Structure proven (AGENTS, rules, skills, research, journal, ADRs, tech-debt, ownership).
- Gaps: `datagouv-api-usage.md` still placeholder; `exec-plans/active/` and `completed/` empty; milestones M1–M6 mostly unchecked (only M0 ticked); TD-006/TD-008 status lags code (`createClients()` wired, facets restored).

### B. Platform/format cartography — **PROVEN**

- Research 01–04, formats skill, `docs/architecture.md` — unchanged and complete.

### C. Full TS package — **PARTIAL**

- **Proven**: 21 tools, modular layers, real clients via `createClients()`, stdio + HTTP, formats accessors, error/cache/retry.
- **Open**: Matomo/Sentry telemetry unwired (TD-002; no `src/server/telemetry/`); `legacy/python/` retained (TD-004); optional schema/geo tools (`list_schemas`, `get_schema`, `validate_resource_against_schema`, `geo_lookup`) deferred per plan.

### D. Test workflows — **PARTIAL** (improved on evidence axis)

- **Proven**: `pnpm check` green; unit tests; `all-tools-offline` e2e; evidence gate; CI workflow exists; Docker smoke.
- **Open**:
  - **Live evidence**: 1/21 tools (`search_datasets` only; TD-007).
  - **Live vitest**: 1 file (`tests/live/search-datasets.live.test.ts`).
  - **Contract tests**: `tests/contract/` absent (fixtures exist, harness not started).
  - **Conformance**: `pnpm test:conformance` fails — script not committed.
  - **Coverage CI**: `pnpm test:coverage` exit 1 (thresholds unmet on clients, formats, tools branches, server functions).
  - **Per-tool handler e2e**: only `search_datasets` has dedicated file; others covered only via batch `all-tools-offline`.
  - **Stress tests**: `tests/stress/` absent.

### E. Docs + changelog + PR — **PARTIAL**

- README, docs set, CHANGELOG, CONTRIBUTING, SECURITY, PR #1 — strong.
- CI not green (coverage step); PR narrative still ahead of live-evidence and coverage gates.

## Milestone snapshot (exec-plan §11)

| Milestone | Status |
|-----------|--------|
| M0 Scaffold | **done** |
| M1 Clients + contract tests | **partial** — clients real; no contract suite |
| M2 Formats layer | **done** |
| M3 Legacy parity + evidence | **partial** — tools + offline evidence OK; live evidence 1/10 legacy; Python not deleted |
| M4 New tools | **partial** — 11 core new tools shipped; optional schema tools deferred |
| M5 Quality gates | **open** — coverage, conformance, live evidence 20/21, stress |
| M6 Release | **open** — legacy retained, no 1.0.0 tag |

## Four explicit open questions (still open?)

| Item | Open? | Evidence |
|------|-------|----------|
| **Telemetry** (Matomo/Sentry) | **Yes** | TD-002 `scheduled`; config parsed in `src/core/config.ts`; no `src/server/telemetry/` |
| **Live tests / live evidence** | **Yes** | TD-007 `open`; 1/21 live reports; 1 live vitest file |
| **Python deletion** | **Yes** | TD-004 `scheduled`; `legacy/python/` present (46 files) |
| **Coverage CI** | **Yes** | `pnpm test:coverage` exit 1; sibling agent actively fixing thresholds + tests |

## Verdict

**Goal is still NOT complete**, but the largest audit blocker on the evidence axis (offline proof for all 21 tools + `evidence:check` gate) is now **closed**. Remaining work for "done": green coverage CI, conformance script, live evidence/tests per tool, contract harness, telemetry wiring, legacy deletion, and `.agent` tracking hygiene (milestones, TD-006/008 resolution).

## Commands run for this review

```
git log -10 --oneline
ls docs/evidence/*-offline-2026-09-03.md | wc -l   → 21
pnpm evidence:check                                 → exit 0
pnpm test:coverage                                  → exit 1 (threshold failures)
```
