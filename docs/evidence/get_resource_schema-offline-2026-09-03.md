# Evidence: get_resource_schema (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93"
}
```

## Output (text, truncated)
```text
Schema of resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Access: tabular_api via tabular-api

Columns (4, source: tabular-api) — rows: 34946:
  - code_insee: string [code_commune]
  - commune: string [commune]
  - departement: string
  - gentile: string

Next: query_resource with filters on these column names.
```

## structuredContent (keys)
- `resource_id`
- `title`
- `capability`
- `accessor`
- `schema`
- `declared_schema`
- `next_tool`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (357 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
