# Evidence: get_metrics (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 11 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataset_id": "53699d0ea3a729239d205b2e",
  "limit": 3
}
```

## Output (text, truncated)
```text
Dataset Metrics: Population
Dataset ID: 53699d0ea3a729239d205b2e

Monthly Statistics:
------------------------------------------------------------
Month        Visits          Downloads
------------------------------------------------------------
2026-09      444             108
2026-08      4,628           3,142
2026-07      4,216           593
------------------------------------------------------------
Total        9,288           3,843
```

## structuredContent (keys)
- `limit`
- `dataset`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (443 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
