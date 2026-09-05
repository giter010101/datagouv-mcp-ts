# Tech Debt Tracker

Known technical debt items. Small, frequent paydown preferred over big-bang refactors.

## How to use

1. Copy `TEMPLATE.md` → `<id>-<short-title>.md` (e.g. `TD-001-duckdb-optional.md`)
2. Fill in impact and proposed fix
3. Orchestrator prioritizes in sprint planning
4. When fixed: set status to `resolved`, note PR link

## Status values

- `open` — acknowledged, not scheduled
- `scheduled` — assigned to upcoming work
- `in_progress` — being addressed
- `resolved` — fixed (link PR)
- `wontfix` — accepted with rationale

## Golden principles (from harness engineering)

1. Prefer shared utility packages over one-off helpers
2. Validate at boundaries (Zod), don't explore data randomly
3. Keep modules small (< 300 lines)
4. No upward imports across layers
5. Evidence report for every tool

## Open items

| ID | Title | Impact | Status |
|----|-------|--------|--------|
| TD-001 | `ServerDeps.datagouv` was a narrow `Pick` | medium | resolved (`createClients` + full `DatagouvClient`) |
| TD-002 | Matomo / Sentry telemetry | medium | partial (Matomo live; Sentry log-only) |
| TD-003 | tsdown 0.21 / TS 5.9 pins due to Node 22.14 VM | low | open (E) |
| TD-004 | Delete `legacy/python/` after parity | low | scheduled (orchestrator) |
| TD-005 | HTTP transport stateless/JSON-only | low | open (C) |
| TD-006 | Non-datagouv client stubs in `server/deps.ts` | medium | resolved (`createClients` in `createDeps`) |
| TD-007 | Missing live evidence reports | medium | resolved (21/21 live + offline) |
| TD-008 | `search_datasets` facets temporarily removed | low | resolved (schema + e2e) |
| TD-009 | Coverage floors below ADR 0010 (honest CI) | medium | open (D) |

## Recurring cleanup

Orchestrator schedules periodic "garbage collection" PRs to address open items.
