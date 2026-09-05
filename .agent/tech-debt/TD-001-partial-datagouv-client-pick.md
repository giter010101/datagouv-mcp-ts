# TD-001: `ServerDeps.datagouv` is a `Pick<DatagouvClient, "searchDatasets">`

**Status**: resolved
**Impact**: medium
**Created**: 2026-09-03
**Owner**: Grok (A + C)

## Description

Only `searchDatasets` was implemented in early scaffold. `ServerDeps` used `DatagouvSearchClient = Pick<DatagouvClient, "searchDatasets">`.

## Resolution

- **Date**: 2026-09-03
- **PR**: #1 (integration branch)
- **Notes**: `createClients()` returns full `Clients` bundle; `server/deps.ts` types `datagouv: DatagouvClient`; all 21 tools registered.
