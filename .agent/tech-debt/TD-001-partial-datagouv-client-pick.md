# TD-001: `ServerDeps.datagouv` is a `Pick<DatagouvClient, "searchDatasets">`

**Status**: scheduled (workstream A + C, milestone M1)
**Impact**: medium
**Created**: 2026-09-03
**Owner**: unassigned

## Description

Only `searchDatasets` is implemented in `HttpDatagouvClient`. To keep the scaffold honest (no methods that throw "not implemented"), `src/clients/datagouv-client.ts` exports `DatagouvSearchClient = Pick<DatagouvClient, "searchDatasets">` and `ServerDeps` / `ToolDeps` use that narrow type.

## Impact

Tools needing other client methods cannot be wired until the type is widened; two places must change together (`src/clients/datagouv-client.ts` `implements`, `src/server/deps.ts`).

## Proposed fix

1. A implements every method of `DatagouvClient` and switches `implements DatagouvSearchClient` → `implements DatagouvClient`.
2. C changes `ServerDeps` to `extends Clients` (`{ datagouv, tabular, metrics, crawler, schema }`) and deletes `DatagouvSearchClient`.
3. Remove `ToolDeps = SearchDatasetsDeps` alias in favour of `ServerDeps`.
