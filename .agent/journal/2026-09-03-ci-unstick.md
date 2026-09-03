# CI unstick — takeover from stuck coverage agent

**Date**: 2026-09-03  
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0` (never switched)  
**Prior agent**: `bc-e93d9b5b` (transcript not accessible; work inferred from git + working tree)

## What was already done

- `921d2c5` had already lowered `COVERAGE_THRESHOLDS` to measured-minus-buffer (`TD-009`).
- `pnpm test:coverage` already passed against those floors; thresholds were **not** lowered again.

## What this takeover finished

- `scripts/conformance.ts` — HTTP loopback initialize + `tools/list` + `tools/call search_datasets` (fixture fetch).
- CI: `pnpm check` required; `pnpm test:coverage` required; `pnpm test:conformance` informational (`continue-on-error`).
- TD-006 / TD-008 marked **resolved** (`createClients` in `deps.ts`; facets + e2e).
- CHANGELOG `[Unreleased]`: live evidence 21/21 + Matomo/Sentry telemetry + conformance.
- Biome format on `scripts/evidence-live.ts` and `tests/contract/harness.ts` so `pnpm check` stays green.

## Local gates (2026-09-03)

| Command | Result |
|---------|--------|
| `pnpm check` | pass (150 tests, 1 skipped) |
| `pnpm test:coverage` | pass — overall **70.46% lines / 71.46% funcs / 51.81% branches / 67.59% stmts** |
| `pnpm evidence:check` | OK — 21 tools, 42 rows |
| `pnpm test:conformance` | OK — 21 tools, total=1234 |

Glob floors remain: clients 55/58/30/52, formats 58/59/48/55, tools 71/70/40/69, server 70/64/55/70, core 80/80/70/80. Raise via TD-009 as suites grow.
