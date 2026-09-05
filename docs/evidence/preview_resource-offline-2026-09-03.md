# Evidence: preview_resource (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  "limit": 5
}
```

## Output (text, truncated)
```text
Preview of resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Access: tabular_api via tabular-api

Columns (5): __id, code_insee, commune, departement, gentile
Rows shown: 5 of 34946

__id | code_insee | commune | departement | gentile
-----|------------|---------|-------------|--------
1 | 01001 | L'Abergement-Clémenciat | 01 | 
2 | 01002 | L'Abergement-de-Varey | 01 | Abergementais, Abergementaises
3 | 01004 | Ambérieu-en-Bugey | 01 | Ambarrois, Ambarroises
4 | 01005 | Ambérieux-en-Dombes | 01 | Ambarrois, Ambarroises
5 | 01006 | Ambléon | 01 | Ambléonais, Ambléonaises

Facts:
  source: tabular-api
  total: 34946
  tabularApi: https://tabular-api.data.gouv.fr/api/resources/a86ebc34-a979-4d6c-8f2a-9710a43dca93/

Next: query_resource.
```

## structuredContent (keys)
- `resource_id`
- `title`
- `capability`
- `accessor`
- `kind`
- `table`
- `features`
- `text`
- `entries`
- `facts`
- `notes`
- `next_tool`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (786 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
