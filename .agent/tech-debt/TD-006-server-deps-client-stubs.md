# TD-006: Non-datagouv client stubs in `server/deps.ts`

**Status**: resolved
**Impact**: medium
**Created**: 2026-09-03
**Owner**: Grok (WS C)

## Description

During early integration, `server/deps.ts` used inline no-op stubs for `tabular`, `metrics`, `crawler`, and `schema` so the server could compile while only `search_datasets` was registered. Commit `3426670` switched to `createClients()`, but concurrent edits on the same file may reintroduce partial stubs.

## Impact

Tools depending on tabular API, metrics, crawler exceptions, or schema catalogue silently degrade (empty results, metadata-only accessors) if stubs remain.

## Proposed fix

1. Ensure `createDeps` always calls `createClients(config, { http, cache })` with no inline stub objects.
2. Add e2e smoke for at least one tool per non-datagouv client (`get_metrics`, `query_resource_data`, `get_resource_schema`).
3. Close when `pnpm test` + live smoke pass with real client wiring.

## Resolution

- **PR**: branch `cursor/datagouv-mcp-typescript-refonte-57e0`
- **Date**: 2026-09-03
- **Notes**: `createDeps` calls `createClients(config, { http, cache })` and wires `tabular`, `metrics`, `crawler`, and `schema` into the formats/tools layers. No inline no-op stubs remain in `src/server/deps.ts`. Offline e2e covers `get_metrics`, `query_resource_data`, and `get_resource_schema`.
