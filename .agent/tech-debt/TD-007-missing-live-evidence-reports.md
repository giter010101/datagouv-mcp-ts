# TD-007: Missing live evidence reports for most tools

**Status**: open
**Impact**: medium
**Created**: 2026-09-03
**Owner**: unassigned (D)

## Description

ADR 0010 and `rules/testing-and-evidence.md` require a proof-of-function report per MCP tool. As of integration day, only `search_datasets` has committed live evidence (`docs/evidence/search_datasets-2026-09-03.md`, `docs/evidence/search_datasets-live.md`). The other 20 registered tools have offline e2e/unit coverage but no live stdio reports.

## Impact

PR reviewers and release managers cannot confirm production behaviour for tabular, metrics, formats, or reference-data tools without running live tests locally.

## Proposed fix

1. Run `pnpm evidence --tool <name> --input '<json>' --stdio` for each tool in `ALL_TOOLS`.
2. Commit `docs/evidence/<tool>-live.md` (or dated variant) per `skills/writing-evidence-report.md`.
3. Wire nightly workflow to fail on missing evidence for registered tools (optional).

## Resolution

_(open)_
