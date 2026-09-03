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

## Recurring cleanup

Orchestrator schedules periodic "garbage collection" PRs to address open items.
