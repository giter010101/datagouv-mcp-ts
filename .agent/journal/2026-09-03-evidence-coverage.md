# Session: evidence coverage gate

**Date**: 2026-09-03
**Agent**: Composer (dev)
**Branch**: cursor/datagouv-mcp-typescript-refonte-57e0

## What was done

- Mapped all 21 `ALL_TOOLS` names to proof artifacts in `docs/evidence/coverage.md`.
- Generated offline evidence markdown by running in-process MCP calls against recorded fixtures (`tests/e2e/all-tools-offline.test.ts`, `EVIDENCE_WRITE=1`).
- Kept existing live `search_datasets` report as the live-mode row.
- Added `scripts/evidence-coverage.ts` and `pnpm evidence:check` (non-zero if a registered tool has no PASS row or a missing file).
- Extended `tests/e2e/tools-list.test.ts` with a frozen name list and availability assertions.

## Files touched

- `docs/evidence/coverage.md` — index table
- `docs/evidence/*-offline-2026-09-03.md` — one report per tool
- `scripts/evidence-coverage.ts` — coverage gate
- `package.json` — `evidence:check`
- `tests/e2e/all-tools-offline.test.ts` — offline calls for every tool
- `tests/e2e/tools-list.test.ts` — registration stability
- `.agent/ownership.md` — workstream D status

## Decisions

- Offline fixtures are acceptable proof for tools without a live stdio run; live remains recorded only for `search_datasets`.
- Coverage is parsed from the markdown table (not a separate JSON map) so the human index is the source of truth.

## Blockers

- None

## Next steps

- [ ] Optional live evidence for remaining tools (`pnpm evidence --stdio`)
- [ ] Contract tests still missing (workstream A/D)
