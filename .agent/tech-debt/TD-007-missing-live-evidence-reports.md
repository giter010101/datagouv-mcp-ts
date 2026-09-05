# TD-007: Missing live evidence reports for most tools

**Status**: resolved
**Impact**: medium
**Created**: 2026-09-03
**Resolved**: 2026-09-03
**Owner**: Composer (D)

## Description

ADR 0010 and `rules/testing-and-evidence.md` require a proof-of-function report per MCP tool. As of integration day, only `search_datasets` had committed live evidence.

## Resolution

All **21** registered tools now have committed live evidence (`docs/evidence/<tool>-live.md`). `docs/evidence/coverage.md` indexes **42 PASS rows** (21 offline + 21 live). `pnpm evidence:check` exits 0.

**Residual gap**: only `tests/live/search-datasets.live.test.ts` automates live regression; other 20 tools rely on committed markdown proof (nightly workflow does not fail on missing live vitest per tool).
