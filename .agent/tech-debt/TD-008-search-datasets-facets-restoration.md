# TD-008: `search_datasets` facet parameters temporarily removed

**Status**: in_progress
**Impact**: low
**Created**: 2026-09-03
**Owner**: Grok (WS C)

## Description

During the WIP integration (`d0c984e`), facet input fields (`organization`, `tag`, `license`, `format`, `badge`, `schema`, `geozone`, `granularity`, `topic`) were dropped from the Zod schema, breaking legacy parity and the e2e test that asserts facet keys. Commit `6c80ba6` restores facet parameters; sibling agent is finishing e2e alignment in `tests/e2e/search-datasets.test.ts`.

## Impact

Agents relying on facet filters cannot narrow dataset search until schema + handler + tests are aligned.

## Proposed fix

1. Keep all facet fields in `searchDatasetsInputSchema` (ADR 0007 compat).
2. Map facets to API v2 query params in the handler.
3. Restore e2e test for facet passthrough (`organization`, `badge`, etc.).

## Resolution

_(in progress — do not close until e2e green on main integration branch)_
