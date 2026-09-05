# 0007: Tool naming and compatibility policy

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: orchestrator, architect

## Context

Thousands of client configurations and prompts reference the legacy tool names (`search_datasets`, `query_resource_data`, …). Breaking them would make the rewrite a regression for users regardless of new capabilities. New tools must nevertheless feel consistent.

## Decision

1. **All 10 legacy tools keep their exact names, titles, parameter names, defaults and clamps** (`page_size` max 100/200, `limit` 1–50, `filter_operator` values, `sort_direction`…). Parameters may be **added** (optional, with defaults), never removed or renamed, in 1.x.
2. Legacy descriptions are kept as the opening paragraphs and extended with return-shape and "next tool" guidance; wording is written for an LLM that has never seen data.gouv.fr.
3. Registration order = legacy order (Appendix A, research/01), new tools appended, so clients that list tools positionally see the same head.
4. Naming grammar for new tools: `snake_case`, `<verb>_<object>[_<qualifier>]` with verbs from {`search`, `list`, `get`, `query`, `preview`, `check`, `suggest`, `validate`}. Objects use data.gouv.fr vocabulary (`dataset`, `resource`, `organization`, `dataservice`, `reuse`, `topic`, `schema`, `metrics`).
5. `query_resource_data` stays the Tabular-API-only tool; the new format-agnostic tool is `query_resource`. Both accept the same filter vocabulary; the legacy one keeps its in-band error strings.
6. Legacy in-band error messages (`Error: Dataset with ID 'x' not found.`) are preserved verbatim as the `message` of the mapped `DatagouvError`; the response additionally sets `isError: true` and `structuredContent.error` (see ADR 0008).
7. Every tool carries `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true`.
8. Removals/renames require: deprecation note in description for one minor release, CHANGELOG entry, alias kept for one more minor.

## Consequences

### Positive
- Drop-in replacement for existing deployments (`mcp.data.gouv.fr`) and local configs.

### Negative
- Some legacy quirks are frozen (`limit` max 50, snake_case with `page_size` while `structuredContent` also uses snake_case — consistent at least).

### Neutral
- `download_and_parse_resource` stays removed; `preview_resource` is the safe successor with a different name on purpose.
